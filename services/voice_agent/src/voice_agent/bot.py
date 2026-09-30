"""Receptionist entry point.

Day 4 builds the real pipeline here:
  SmallWebRTC transport → Silero VAD + Smart Turn → STT → LLM (+ clinic tools) → TTS → transport
"""

import os

from dotenv import load_dotenv

from voice_agent.stacks import STACKS


def main() -> None:
    load_dotenv()
    stack = STACKS[os.getenv("VOICE_STACK", "local")]
    print(f"voice_agent: stack={stack.name} stt={stack.stt} llm={stack.llm} tts={stack.tts}")
    print("Pipeline not built yet: see Day 4 in the 20-day plan.")


if __name__ == "__main__":
    main()
