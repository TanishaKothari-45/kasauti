"""Asha's server. Text chat over WebSocket now; Day 4 adds the WebRTC voice endpoint here."""

import logging
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from voice_agent.llm import ChatTurn, LLMUnavailable, stream_reply
from voice_agent.prompts import GREETING, PROMPT_VERSION
from voice_agent.settings import settings

logger = logging.getLogger("voice_agent")
MAX_MESSAGE_CHARS = 1000

app = FastAPI(title="Voice agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {
        "service": "voice_agent",
        "status": "ok",
        "model": settings.gemini_model,
        "prompt": PROMPT_VERSION,
        "llm_key_set": bool(settings.google_api_key),
    }


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
