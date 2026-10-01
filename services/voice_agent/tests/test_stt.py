from fastapi.testclient import TestClient

from voice_agent import server
from voice_agent.stt import Transcript

client = TestClient(server.app)


def test_stt_rejects_unknown_language():
    response = client.post("/stt", files={"audio": ("a.webm", b"x")}, data={"language": "fr"})
    assert response.status_code == 422


def test_stt_rejects_unknown_provider():
    response = client.post("/stt", files={"audio": ("a.webm", b"x")}, data={"provider": "nope"})
    assert response.status_code == 422


def test_stt_groq_needs_a_key(monkeypatch):
    monkeypatch.setattr(server.settings, "groq_api_key", "")
    response = client.post("/stt", files={"audio": ("a.webm", b"x")}, data={"provider": "groq"})
    assert response.status_code == 422
    assert "GROQ_API_KEY" in response.json()["detail"]


def test_stt_rejects_empty_upload():
    response = client.post("/stt", files={"audio": ("a.webm", b"")})
    assert response.status_code == 400


def test_stt_returns_transcript(monkeypatch):
    def fake_transcribe(path, language, provider):
        assert (language, provider) == ("hi", "local")
        return Transcript("मुझे कल आना है", "hi", 2.1, 480, "whisper-test", "local")

    monkeypatch.setattr(server, "transcribe_file", fake_transcribe)
    response = client.post(
        "/stt", files={"audio": ("a.webm", b"fake")}, data={"language": "hi", "provider": "local"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "text": "मुझे कल आना है",
        "language": "hi",
        "audio_seconds": 2.1,
        "latency_ms": 480,
        "model": "whisper-test",
        "provider": "local",
    }
