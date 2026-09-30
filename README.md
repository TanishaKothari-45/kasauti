# Kasauti

**A Hindi / English / Hinglish voice receptionist for small clinics, and Kasauti, the harness that breaks it, measures it and proves every fix.**

*Kasauti (कसौटी): the touchstone used to test gold.*

The receptionist answers calls, books, reschedules and cancels appointments, answers questions about the clinic, and sends urgent symptoms to a human. Kasauti calls it with simulated callers carrying real-world mess (street noise, 8 kHz phone lines, code-mixing, interruptions, real Indian voices), grades every call, and tracks each optimisation round.

> 🚧 Work in progress: a 20-day build. Results, heatmaps and before/after numbers will land here.

## The loop
1. **Build** the receptionist: voice pipeline, tools, clinic knowledge.
2. **Break** it with Kasauti callers and audio distortions.
3. **Measure** task success, recognition error, latency, barge-in and safety.
4. **Fix** one failure category per round, with before/after numbers.

## Architecture
See [docs/architecture.md](docs/architecture.md).

| Node | Tech |
|---|---|
| `services/clinic_api` | FastAPI, SQLAlchemy (async), Postgres |
| `services/voice_agent` | Pipecat · Silero VAD + Smart Turn · Whisper turbo (mlx) · Gemini Flash · Kokoro |
| `services/kasauti` | audiomentations, jiwer, persona callers, graders, LLM judge |
| `web` | Next.js, TypeScript, Tailwind, Pipecat client |

## Run it locally (macOS, Apple Silicon)
```bash
cp .env.example .env        # add your free Gemini / Groq keys
make setup                  # uv sync + npm install
make db-up                  # Postgres in Docker
make api                    # http://localhost:8000/docs
make web                    # http://localhost:3000
```

Requires: Docker, [uv](https://docs.astral.sh/uv/), Node 22 (`nvm use`), ffmpeg.
