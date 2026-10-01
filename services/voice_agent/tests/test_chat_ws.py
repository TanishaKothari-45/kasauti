from fastapi.testclient import TestClient

from voice_agent import server
from voice_agent.prompts import GREETING


def test_chat_greets_then_reports_missing_key(monkeypatch):
    monkeypatch.setattr(server.settings, "google_api_key", "")
    with TestClient(server.app).websocket_connect("/ws/chat") as ws:
        assert ws.receive_json()["type"] == "session"
        assert ws.receive_json() == {"type": "assistant_done", "text": GREETING}

        ws.send_json({"type": "user_message", "text": "Kal appointment chahiye"})
        message = ws.receive_json()

    assert message["type"] == "error"
    assert "GOOGLE_API_KEY" in message["message"]


def test_chat_rejects_unknown_message_type(monkeypatch):
    monkeypatch.setattr(server.settings, "google_api_key", "")
    with TestClient(server.app).websocket_connect("/ws/chat") as ws:
        ws.receive_json()
        ws.receive_json()
        ws.send_json({"type": "something_else"})
        assert ws.receive_json() == {"type": "error", "message": "Unknown message type."}
