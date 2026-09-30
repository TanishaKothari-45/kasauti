# Architecture

```
                 ┌───────────────────────────────┐
  browser mic ──▶│  voice_agent  (Pipecat, :7860) │── tools over HTTP ──▶ clinic_api (FastAPI, :8000) ──▶ Postgres
  (web :3000)    │  VAD → STT → LLM → TTS         │                                   ▲
                 └───────────────────────────────┘                                   │
                          ▲                                                           │
                          │ WebRTC calls with simulated callers                       │ state-diff checks
                 ┌───────────────────────────────┐                                   │
                 │  kasauti  (eval harness, CLI)  │───────────────────────────────────┘
                 │  callers · distortions ·       │
                 │  graders · judge · runs        │──▶ runs/ (results) ──▶ web console
                 └───────────────────────────────┘
```

| Node | What it is | Runs where (dev) |
|---|---|---|
| `services/clinic_api` | FastAPI + SQLAlchemy. Doctors, slots, patients, appointments. The receptionist's tools call it. | Native, `make api` |
| `services/voice_agent` | Pipecat pipeline: Silero VAD + Smart Turn → Whisper turbo (mlx) → Gemini Flash + tools → Kokoro. Stack chosen by `VOICE_STACK`. | Native (needs Metal), `make agent` |
| `services/kasauti` | The harness: persona callers, audio distortions, graders, LLM judge, run reports. | Native CLI, `uv run kasauti` |
| `web` | Next.js console: service status, clinic data, talk to the agent, Kasauti results. | Native, `make web` |
| Postgres | Clinic state. Kasauti reads it to grade outcomes. | Docker, `make db-up` |

## Why the agent isn't in Docker
mlx-whisper uses Apple's Metal GPU, which containers on macOS can't reach. In production the agent uses hosted speech APIs, so it can be containerised then.

## Stack profiles
`VOICE_STACK=local` (free, on-device) is the default for development. `VOICE_STACK=sarvam` swaps speech-to-text, LLM and text-to-speech for Sarvam's APIs; week 3 benchmarks both on the same Kasauti suite.
