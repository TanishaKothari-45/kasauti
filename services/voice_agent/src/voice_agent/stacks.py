"""Voice stack profiles. The pipeline reads one; Kasauti benchmarks them against each other."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Stack:
    name: str
    stt: str
    llm: str
    tts: str


STACKS = {
    "local": Stack("local", stt="mlx-whisper large-v3-turbo", llm="gemini-flash", tts="kokoro-82m"),
    "sarvam": Stack("sarvam", stt="sarvam-stt", llm="sarvam-105b", tts="sarvam-bulbul"),
}
