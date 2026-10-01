"""Asha's server. Text chat over WebSocket now; Day 4 adds the WebRTC voice endpoint here."""

import asyncio
import logging
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from voice_agent import live
from voice_agent.llm import ChatTurn, LLMUnavailable, stream_reply
from voice_agent.prompts import GREETING, PROMPT_VERSION
from voice_agent.settings import settings
from voice_agent.stt import (
    ProviderUnavailable,
    SttEngineError,
    available_providers,
    parse_language,
    parse_provider,
    transcribe_file,
)

logger = logging.getLogger("voice_agent")
MAX_MESSAGE_CHARS = 1000
MAX_AUDIO_BYTES = 10 * 1024 * 1024
# One local transcription at a time: they share the M1's GPU, and queueing keeps latency honest.
_stt_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await live.webrtc.close()


app = FastAPI(title="Voice agent", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(live.router)


@app.get("/health")
async def health() -> dict:
    return {
        "service": "voice_agent",
        "status": "ok",
        "model": settings.gemini_model,
        "stt_model": settings.whisper_model,
        "stt_default": settings.stt_provider,
        "stt_providers": available_providers(),
        "prompt": PROMPT_VERSION,
        "llm_key_set": bool(settings.google_api_key),
    }


@app.post("/stt")
async def speech_to_text(
    audio: Annotated[UploadFile, File(description="Recorded clip, any format ffmpeg can read")],
    language: Annotated[str, Form()] = "auto",
    provider: Annotated[str | None, Form()] = None,
) -> dict:
    """Push-to-talk: one recorded clip in, one transcript out."""
    try:
        whisper_language = parse_language(language)
        engine = parse_provider(provider)
    except (ValueError, ProviderUnavailable) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The audio upload was empty.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio is larger than 10 MB.")

    suffix = Path(audio.filename or "clip.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix) as clip:
        clip.write(data)
        clip.flush()
        try:
            if engine == "local":
                async with _stt_lock:
                    transcript = await asyncio.to_thread(
                        transcribe_file, clip.name, whisper_language, engine
                    )
            else:
                transcript = await asyncio.to_thread(
                    transcribe_file, clip.name, whisper_language, engine
                )
        except SttEngineError as exc:  # the engine answered with an error (e.g. Groq API)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except RuntimeError as exc:  # ffmpeg could not decode the upload
            raise HTTPException(status_code=400, detail="Couldn't decode that audio.") from exc
    return transcript.as_dict()


@app.websocket("/ws/chat")
async def chat(ws: WebSocket) -> None:
    """Protocol (JSON):
    client → {"type": "user_message", "text": str}
    server → {"type": "session"} once, then per reply: "assistant_delta"* → "assistant_done",
             or {"type": "error", "message": str}
    """
    await ws.accept()
    session_id = uuid.uuid4().hex[:12]
    history: list[ChatTurn] = [ChatTurn("model", GREETING)]
    await ws.send_json({"type": "session", "session_id": session_id, "prompt": PROMPT_VERSION})
    await ws.send_json({"type": "assistant_done", "text": GREETING})

    try:
        while True:
            message = await ws.receive_json()
            if message.get("type") != "user_message":
                await ws.send_json({"type": "error", "message": "Unknown message type."})
                continue
            text = str(message.get("text", "")).strip()[:MAX_MESSAGE_CHARS]
            if not text:
                continue

            history.append(ChatTurn("user", text))
            parts: list[str] = []
            try:
                async for delta in stream_reply(history):
                    parts.append(delta)
                    await ws.send_json({"type": "assistant_delta", "text": delta})
            except LLMUnavailable as exc:
                history.pop()
                logger.warning("session %s: %s", session_id, exc)
                await ws.send_json({"type": "error", "message": str(exc)})
                continue

            reply = "".join(parts).strip()
            history.append(ChatTurn("model", reply))
            await ws.send_json({"type": "assistant_done", "text": reply})
    except WebSocketDisconnect:
        logger.info("session %s ended after %d turns", session_id, len(history))
