"use client";

import { useCallback, useEffect, useState } from "react";
import {
  agentHealth,
  transcribe,
  type SttLanguage,
  type SttProvider,
  type Transcript,
} from "@/lib/agent";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useHandsFree, type TurnEvent } from "@/hooks/useHandsFree";

type Mode = "push" | "hands-free";
type Utterance = { id: number; transcript?: Transcript; error?: string; pending?: boolean };

const LANGUAGES: { value: SttLanguage; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "hi", label: "हिंदी" },
  { value: "en", label: "English" },
];

const ENGINES: { value: SttProvider; label: string }[] = [
  { value: "local", label: "Local M1" },
  { value: "groq", label: "Groq cloud" },
];

const EVENT_LABEL: Record<TurnEvent["kind"], string> = {
  "turn-start": "turn started",
  segment: "segment",
  "turn-end": "turn ended → Asha",
};

let nextId = 0;

interface CallerPanelProps {
  onTurn: (text: string) => void;
}

export function CallerPanel({ onTurn }: CallerPanelProps) {
  const [mode, setMode] = useState<Mode>("push");
  const [language, setLanguage] = useState<SttLanguage>("auto");
  const [engine, setEngine] = useState<SttProvider>("local");
  const [engines, setEngines] = useState<SttProvider[]>(["local"]);
  const [autoSend, setAutoSend] = useState(true);
  const [utterances, setUtterances] = useState<Utterance[]>([]);

  const deliver = useCallback(
    (text: string) => {
      if (autoSend) onTurn(text);
    },
    [autoSend, onTurn],
  );

  // Which engines the server can run, and its default (STT_PROVIDER in .env).
  useEffect(() => {
    agentHealth()
      .then((h) => {
        setEngines(h.stt_providers);
        setEngine(h.stt_default);
      })
      .catch(() => undefined);
  }, []);

  const onClip = useCallback(
    (clip: Blob) => {
      const id = nextId++;
      setUtterances((prev) => [...prev, { id, pending: true }]);
      transcribe(clip, language, engine)
        .then((transcript) => {
          setUtterances((prev) => prev.map((u) => (u.id === id ? { id, transcript } : u)));
          if (transcript.text) deliver(transcript.text);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Transcription failed.";
          setUtterances((prev) => prev.map((u) => (u.id === id ? { id, error: message } : u)));
        });
    },
    [deliver, engine, language],
  );

  const ptt = usePushToTalk(onClip);
  const live = useHandsFree(deliver);
  const busy =
    ptt.state === "recording" || live.state === "listening" || live.state === "connecting";

  return (
    <section
      aria-label="Caller"
      className="flex flex-col gap-4 rounded-2xl border border-rule bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        <div
          className="grid size-12 place-items-center rounded-full bg-ground text-lg font-semibold"
          aria-hidden
        >
          🙂
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold">Caller</span>
          <span className="text-sm text-muted">Your microphone · speech → text</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Input mode" className="flex rounded-lg border border-rule p-0.5">
          {(["push", "hands-free"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={busy}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                mode === m ? "bg-ink text-surface" : "text-muted"
              }`}
            >
              {m === "push" ? "Push-to-talk" : "Hands-free (VAD)"}
            </button>
          ))}
        </div>
        <label htmlFor="caller-language" className="sr-only">
          Speech language
        </label>
        <select
          id="caller-language"
          value={language}
          disabled={busy}
          onChange={(e) => setLanguage(e.target.value as SttLanguage)}
          className="rounded-lg border border-rule bg-ground px-2.5 py-1.5 text-xs disabled:opacity-50"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <label htmlFor="caller-engine" className="sr-only">
          Speech-to-text engine
        </label>
        <select
          id="caller-engine"
          value={engine}
          disabled={busy}
          onChange={(e) => setEngine(e.target.value as SttProvider)}
          className="rounded-lg border border-rule bg-ground px-2.5 py-1.5 text-xs disabled:opacity-50"
        >
          {ENGINES.map((en) => (
            <option key={en.value} value={en.value} disabled={!engines.includes(en.value)}>
              {en.label}
            </option>
          ))}
        </select>
        <label htmlFor="caller-auto-send" className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <input
            id="caller-auto-send"
            type="checkbox"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            className="accent-[var(--gold)]"
          />
          Send to Asha
        </label>
      </div>

      <div className="flex h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-ground p-4" aria-live="polite">
        {mode === "push" ? (
          <>
            {utterances.length === 0 && (
              <p className="m-auto max-w-[17rem] text-center text-sm text-faint">
                Tap to speak, then tap again to stop. The clip goes to Whisper and the text appears here.
              </p>
            )}
            {utterances.map((u) => (
              <div key={u.id} className="flex flex-col items-end gap-1">
                <p
                  className={`max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm shadow-sm ${
                    u.error ? "bg-bad-soft text-bad" : "bg-ink text-surface"
                  }`}
                >
                  {u.pending
                    ? "Transcribing…"
                    : (u.error ?? (u.transcript?.text || "(no speech detected)"))}
                </p>
                {u.transcript && (
                  <span className="font-mono text-[10px] text-faint tabular-nums">
                    {u.transcript.provider} · {u.transcript.language ?? "?"} ·{" "}
                    {u.transcript.audio_seconds}s audio · {u.transcript.latency_ms} ms
                  </span>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            {live.events.length === 0 && (
              <p className="m-auto max-w-[17rem] text-center text-sm text-faint">
                {live.state === "listening"
                  ? "Listening… speak naturally. Pause mid-sentence and watch what happens."
                  : "Start listening and just talk. Silero detects speech, Whisper transcribes each segment, Smart Turn decides when you're done."}
              </p>
            )}
            <ol className="flex flex-col gap-1.5 font-mono text-xs">
              {live.events.map((e) => (
                <li
                  key={e.id}
                  className={e.kind === "turn-end" ? "rounded-md bg-gold-soft px-2 py-1" : "px-2"}
                >
                  <span className="tabular-nums text-faint">{e.at.toFixed(1)}s</span>{" "}
                  <span className={e.kind === "segment" ? "text-muted" : "font-semibold"}>
                    {EVENT_LABEL[e.kind]}
                  </span>
                  {e.text && <span className="font-sans text-sm"> “{e.text}”</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {mode === "push" ? (
        <button
          type="button"
          onClick={ptt.state === "recording" ? ptt.stop : ptt.start}
          className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold ${
            ptt.state === "recording" ? "bg-bad text-surface" : "bg-ink text-surface"
          }`}
        >
          {ptt.state === "recording" ? "■ Tap to stop" : "🎙 Tap to speak"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => (live.state === "listening" ? live.stop() : live.start(language, engine))}
          disabled={live.state === "connecting"}
          className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold disabled:opacity-50 ${
            live.state === "listening" ? "bg-bad text-surface" : "bg-ink text-surface"
          }`}
        >
          {live.state === "listening"
            ? "■ Stop listening"
            : live.state === "connecting"
              ? "Connecting…"
              : "🎙 Start listening"}
        </button>
      )}
      <p className="-mt-2 text-center text-xs text-faint">
        {ptt.state === "denied"
          ? "Microphone access was blocked. Allow it in the browser's site settings."
          : live.state === "error"
            ? "Couldn't start listening. Is `make agent` running?"
            : engine === "groq"
              ? "Whisper large-v3-turbo on Groq. Audio is sent to Groq."
              : "Whisper large-v3-turbo on your M1."}
      </p>
    </section>
  );
}
