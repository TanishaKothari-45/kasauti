import { Panel } from "@/components/Panel";
import { Pill } from "@/components/Pill";
import { ServiceStatus } from "@/components/ServiceStatus";

const STACK = [
  ["Turn-taking", "Silero VAD + Smart Turn"],
  ["Speech → text", "Whisper large-v3-turbo (mlx)"],
  ["Brain + tools", "Gemini Flash"],
  ["Text → speech", "Kokoro-82M"],
];

const LOOP = [
  ["Build", "Receptionist: voice, tools, clinic knowledge"],
  ["Break", "Callers with noise, 8 kHz lines, code-mixing, interruptions"],
  ["Measure", "Task success, recognition error, latency, barge-in, safety"],
  ["Fix", "One failure category per round, before/after numbers"],
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-5">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
            कसौटी · the touchstone
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Kasauti console</h1>
          <p className="max-w-2xl text-sm text-muted">
            A Hinglish voice receptionist for a small clinic, and the harness that breaks it,
            measures it and proves every fix.
          </p>
        </div>
        <Pill tone="good">stack: local</Pill>
      </header>

      <ServiceStatus />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel eyebrow="Arrives Day 2" title="Clinic data">
          <p className="text-sm text-muted">
            Doctors, open slots and bookings from the clinic API will show here once the schema and
            endpoints are built.
          </p>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel eyebrow="Arrives Day 4" title="Talk to the receptionist">
            <p className="mb-4 text-sm text-muted">
              Speak from your browser in Hindi or English. The agent books, reschedules and cancels
              against the clinic above.
            </p>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md border border-rule bg-ground px-4 py-2.5 text-sm font-medium text-faint"
            >
              Start call · not built yet
            </button>
          </Panel>

          <Panel eyebrow="VOICE_STACK=local" title="Voice stack">
            <dl className="flex flex-col gap-2 text-sm">
              {STACK.map(([part, model]) => (
                <div key={part} className="flex justify-between gap-3">
                  <dt className="text-muted">{part}</dt>
                  <dd className="text-right font-mono text-xs">{model}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <Panel eyebrow="Kasauti · no runs yet" title="The loop">
        <ol className="grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(([step, what], i) => (
            <li key={step} className="flex flex-col gap-1 bg-surface p-4">
              <span className="font-mono text-[10px] tracking-widest text-gold">
                {i + 1} · {step.toUpperCase()}
              </span>
              <span className="text-sm text-muted">{what}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          The first baseline run lands on Day 11. Results, the failure heatmap and each
          optimisation round will show here.
        </p>
      </Panel>
    </main>
  );
}
