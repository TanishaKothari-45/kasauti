"use client";

import { useEffect, useState } from "react";
import { clinicApi } from "@/lib/api";
import { VOICE_AGENT_URL } from "@/lib/config";
import { Pill, type Tone } from "./Pill";

type Service = { name: string; where: string; tone: Tone; state: string; detail: string };

async function checkAgent(): Promise<boolean> {
  try {
    await fetch(VOICE_AGENT_URL, { signal: AbortSignal.timeout(1500), mode: "no-cors" });
    return true;
  } catch {
    return false;
  }
}

async function probe(): Promise<Service[]> {
  const [health, agentUp] = await Promise.all([
    clinicApi.health().catch(() => null),
    checkAgent(),
  ]);
  return [
    {
      name: "Clinic API",
      where: ":8000",
      tone: health ? "good" : "bad",
      state: health ? "Up" : "Down",
      detail: health ? "Tools backend for the receptionist" : "Start it with `make api`",
    },
    {
      name: "Database",
      where: "Postgres · Docker :5432",
      tone: "planned",
      state: "Day 2",
      detail: "Clinic schema: doctors, slots, patients, appointments",
    },
    {
      name: "Voice agent",
      where: ":7860",
      tone: agentUp ? "good" : "planned",
      state: agentUp ? "Up" : "Day 4",
      detail: "Pipecat pipeline: VAD → Whisper → Gemini → Kokoro",
    },
    {
      name: "Kasauti",
      where: "CLI",
      tone: "planned",
      state: "Week 2",
      detail: "Callers, distortions, graders. Try `uv run kasauti info`",
    },
  ];
}

const PLACEHOLDER: Service[] = ["Clinic API", "Database", "Voice agent", "Kasauti"].map((name) => ({
  name,
  where: "…",
  tone: "warn",
  state: "Checking",
  detail: "Checking the local service…",
}));

export function ServiceStatus() {
  const [services, setServices] = useState<Service[] | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => probe().then((s) => alive && setServices(s));
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(services ?? PLACEHOLDER).map((s) => (
        <div key={s.name} className="flex flex-col gap-2 rounded-lg border border-rule bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{s.name}</span>
            <Pill tone={s.tone}>{s.state}</Pill>
          </div>
          <span className="font-mono text-xs text-faint">{s.where}</span>
          <span className="text-sm text-muted">{s.detail}</span>
        </div>
      ))}
    </div>
  );
}
