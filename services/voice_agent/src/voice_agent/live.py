"""Hands-free listening over WebRTC.

browser mic → Silero VAD (is someone speaking?) → Whisper, once per speech segment
            → Smart Turn (has the caller finished their turn?) → TurnAssembler

A turn starts only when Silero hears speech and ends only when Smart Turn says the caller is
done. Segment transcripts are buffered in between and sent to the browser as ONE `user-turn`
message per turn. Pipecat's RTVI layer also streams each segment (`user-transcription`) so the
UI can show progress. No LLM runs here yet: the browser forwards each finished turn to Asha's
chat, so there is still only one "brain".
"""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.turns.user_start import VADUserTurnStartStrategy
from pipecat.turns.user_turn_processor import UserTurnProcessor
from pipecat.turns.user_turn_strategies import UserTurnStrategies

from voice_agent.stt import ProviderUnavailable, parse_language, parse_provider, stt_service

logger = logging.getLogger("voice_agent.live")
router = APIRouter(prefix="/api", tags=["live"])
webrtc = SmallWebRTCRequestHandler()


class TurnAssembler(FrameProcessor):
    """Buffers segment transcripts; when the turn ends, emits one `user-turn` message.

    A transcript that lands after the turn has already closed (slow speech-to-text) is held
    and joins the next turn rather than being lost.
    """

    def __init__(self) -> None:
        super().__init__()
        self._segments: list[str] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and frame.text.strip():
            self._segments.append(frame.text.strip())
        elif isinstance(frame, UserStoppedSpeakingFrame) and self._segments:
            text = " ".join(self._segments)
            message = {"type": "user-turn", "text": text, "segments": len(self._segments)}
            self._segments = []
            logger.info("user turn complete: %r", text)
            await self.push_frame(RTVIServerMessageFrame(data=message))
        elif isinstance(frame, UserStartedSpeakingFrame):
            logger.debug("user turn started (%d held segments)", len(self._segments))


async def listen(connection: SmallWebRTCConnection, language: str | None, provider: str) -> None:
    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(audio_in_enabled=True),
    )
    pipeline = Pipeline(
        [
            transport.input(),
            VADProcessor(vad_analyzer=SileroVADAnalyzer()),
            stt_service(language, provider),
            # Only Silero may start a turn (Pipecat's default also starts one whenever a
            # transcript arrives, which split sentences when transcripts came back late).
            # The stop side stays the default: Smart Turn v3 decides when the caller is done.
            UserTurnProcessor(
                user_turn_strategies=UserTurnStrategies(start=[VADUserTurnStartStrategy()])
            ),
            TurnAssembler(),
            transport.output(),
        ]
    )
    task = PipelineTask(pipeline, enable_rtvi=True, idle_timeout_secs=None)

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        await task.cancel()

    await PipelineRunner(handle_sigint=False).run(task)
    logger.info("listening session %s closed", connection.pc_id)


@router.post("/offer")
async def offer(request: Request, background_tasks: BackgroundTasks) -> dict | None:
    webrtc_request = SmallWebRTCRequest.from_dict(await request.json())
    data = webrtc_request.request_data if isinstance(webrtc_request.request_data, dict) else {}
    try:
        language = parse_language(str(data.get("language", "auto")))
        provider = parse_provider(data.get("provider"))
    except (ValueError, ProviderUnavailable) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    async def on_connection(connection: SmallWebRTCConnection) -> None:
        background_tasks.add_task(listen, connection, language, provider)

    return await webrtc.handle_web_request(webrtc_request, on_connection)


@router.patch("/offer")
async def ice_candidate(request: SmallWebRTCPatchRequest) -> dict:
    await webrtc.handle_patch_request(request)
    return {"status": "success"}
