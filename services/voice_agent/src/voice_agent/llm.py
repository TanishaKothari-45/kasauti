"""Gemini streaming for Asha. Day 4 replaces this call path with the Pipecat pipeline."""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Literal

from google import genai
from google.genai import errors, types

from voice_agent.prompts import SYSTEM_PROMPT
from voice_agent.settings import settings


@dataclass(frozen=True)
class ChatTurn:
    role: Literal["user", "model"]
    text: str


class LLMUnavailable(RuntimeError):
    """The model could not answer; the message is safe to show on the patient's screen."""


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if not settings.google_api_key:
        raise LLMUnavailable("GOOGLE_API_KEY is not set. Add it to .env and restart the agent.")
    if _client is None:
        _client = genai.Client(api_key=settings.google_api_key)
    return _client


def _contents(history: Sequence[ChatTurn]) -> list[types.Content]:
    # Gemini expects the conversation to open with a user turn; the spoken greeting lives in the
    # system prompt ("You have already greeted the patient").
    turns = list(history)
    while turns and turns[0].role != "user":
        turns.pop(0)
    return [types.Content(role=t.role, parts=[types.Part(text=t.text)]) for t in turns]


def _config() -> types.GenerateContentConfig:
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.4,
        max_output_tokens=400,
    )
    if "flash" in settings.gemini_model:
        # Receptionist replies are short; skipping "thinking" keeps time-to-first-word low.
        config.thinking_config = types.ThinkingConfig(thinking_budget=0)
    return config


async def stream_reply(history: Sequence[ChatTurn]) -> AsyncIterator[str]:
    client = _get_client()
    try:
        stream = await client.aio.models.generate_content_stream(
            model=settings.gemini_model, contents=_contents(history), config=_config()
        )
        async for chunk in stream:
            if chunk.text:
                yield chunk.text
    except errors.APIError as exc:
        raise LLMUnavailable(f"Gemini error {exc.code}: {exc.message}") from exc
