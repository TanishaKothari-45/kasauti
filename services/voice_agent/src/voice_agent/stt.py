"""Speech-to-text. One configuration, shared by push-to-talk, the live pipeline and Kasauti,
so every path hears the caller the same way.

Two engines run the same model (Whisper large-v3-turbo) with the same language and silence
rules, so comparing them isolates where the model runs:
  local  mlx-whisper on this Mac's GPU   free, private, slow on a base M1
  groq   Groq's hosted inference         free tier, fast, audio leaves the machine
"""

import io
import time
import wave
from dataclasses import asdict, dataclass
from pathlib import Path

import mlx_whisper
import numpy as np
from groq import APIError, Groq
from mlx_whisper.audio import SAMPLE_RATE, load_audio
from pipecat.services.groq.stt import GroqSTTService
from pipecat.services.stt_service import STTService
from pipecat.services.whisper.stt import WhisperSTTServiceMLX
from pipecat.transcriptions.language import Language

from voice_agent.settings import settings

PROVIDERS = ("local", "groq")
GROQ_MODEL = "whisper-large-v3-turbo"
# "auto" lets Whisper detect the language per clip; Hindi/English pin it.
LANGUAGES: dict[str, str | None] = {"auto": None, "hi": "hi", "en": "en"}
# Groq's verbose_json names languages in full; normalise to the codes the local engine returns.
LANGUAGE_NAMES = {"english": "en", "hindi": "hi"}
TEMPERATURE = 0.0
# Whisper scores each segment for "probably not speech"; drop those (it hallucinates on silence).
NO_SPEECH_PROB = 0.4


class ProviderUnavailable(ValueError):
    """The requested engine can't run (unknown name or missing API key)."""


class SttEngineError(RuntimeError):
    """The engine was reachable but failed to transcribe (e.g. a Groq API error)."""


def parse_language(code: str) -> str | None:
    if code not in LANGUAGES:
        raise ValueError(f"language must be one of: {', '.join(LANGUAGES)}")
    return LANGUAGES[code]


def available_providers() -> list[str]:
    return ["local"] + (["groq"] if settings.groq_api_key else [])


def parse_provider(name: str | None) -> str:
    provider = name or settings.stt_provider
    if provider not in PROVIDERS:
        raise ProviderUnavailable(f"provider must be one of: {', '.join(PROVIDERS)}")
    if provider not in available_providers():
        raise ProviderUnavailable("GROQ_API_KEY is not set. Add it to .env and restart the agent.")
    return provider


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str | None
    audio_seconds: float
    latency_ms: int
    model: str
    provider: str

    def as_dict(self) -> dict:
        return asdict(self)


def _speech_only(segments: list[dict]) -> str:
    return " ".join(
        segment["text"].strip()
        for segment in segments
        if segment.get("no_speech_prob", 0.0) < NO_SPEECH_PROB
    ).strip()


def _wav_bytes(audio: np.ndarray) -> bytes:
    """16 kHz mono 16-bit WAV, built in memory from the decoded samples."""
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(pcm.tobytes())
    return buffer.getvalue()


def transcribe_file(path: Path | str, language: str | None, provider: str = "local") -> Transcript:
    """Blocking: transcribe any ffmpeg-readable file. Run it off the event loop.

    The file is decoded once to 16 kHz mono and both engines receive exactly those samples,
    so a comparison between them measures the engine, not the input format.
    """
    audio = load_audio(str(path))
    audio_seconds = round(len(audio) / SAMPLE_RATE, 2)

    if provider == "groq":
        wav = _wav_bytes(audio)
        started = time.perf_counter()
        try:
            response = Groq(api_key=settings.groq_api_key).audio.transcriptions.create(
                file=("clip.wav", wav),
                model=GROQ_MODEL,
                language=language,
                temperature=TEMPERATURE,
                response_format="verbose_json",
            )
        except APIError as exc:
            raise SttEngineError(f"Groq error: {exc.message}") from exc
        result = response.to_dict()
        model = f"groq/{GROQ_MODEL}"
    else:
        started = time.perf_counter()
        result = mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=settings.whisper_model,
            language=language,
            temperature=TEMPERATURE,
            condition_on_previous_text=False,
        )
        model = settings.whisper_model

    latency_ms = round((time.perf_counter() - started) * 1000)
    detected = str(result.get("language") or "").lower() or None
    return Transcript(
        text=_speech_only(result.get("segments") or []),
        language=LANGUAGE_NAMES.get(detected, detected) if detected else None,
        audio_seconds=audio_seconds,
        latency_ms=latency_ms,
        model=model,
        provider=provider,
    )


def stt_service(language: str | None, provider: str = "local") -> STTService:
    """The same engine and settings, as a Pipecat service for the live pipeline."""
    lang = Language(language) if language else None
    if provider == "groq":
        return GroqSTTService(
            api_key=settings.groq_api_key,
            settings=GroqSTTService.Settings(
                model=GROQ_MODEL, language=lang, temperature=TEMPERATURE
            ),
        )
    return WhisperSTTServiceMLX(
        settings=WhisperSTTServiceMLX.Settings(
            model=settings.whisper_model,
            language=lang,
            temperature=TEMPERATURE,
            no_speech_prob=NO_SPEECH_PROB,
        )
    )
