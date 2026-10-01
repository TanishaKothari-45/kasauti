"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentStatus, AshaChat, ChatLine } from "@/hooks/useAshaChat";

const STATUS: Record<AgentStatus, { label: string; style: string }> = {
  checking: { label: "Connecting…", style: "bg-warn-soft text-warn" },
  online: { label: "Online", style: "bg-good-soft text-good" },
  "no-key": { label: "No LLM key", style: "bg-warn-soft text-warn" },
  offline: { label: "Offline", style: "bg-bad-soft text-bad" },
};

const BUBBLE: Record<ChatLine["who"], string> = {
  asha: "self-start rounded-bl-sm bg-surface",
  you: "self-end rounded-br-sm bg-ink text-surface",
  system: "self-center bg-bad-soft text-bad text-xs",
};

interface AshaPanelProps {
  chat: AshaChat;
}

export function AshaPanel({ chat }: AshaPanelProps) {
  const [draft, setDraft] = useState("");
  const transcript = useRef<HTMLDivElement>(null);
  const live = chat.call === "live";

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [chat.lines]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    chat.send(draft);
    setDraft("");
  }

  return (
    <section
      aria-label="Asha"
      className="flex flex-col gap-4 rounded-2xl border border-rule bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        <div
          className="grid size-12 place-items-center rounded-full bg-gold-soft text-lg font-semibold text-gold"
          aria-hidden
        >
          आ
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold">Asha</span>
          <span className="text-sm text-muted">Receptionist · text → reply</span>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs ${STATUS[chat.status].style}`}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {live ? "In call" : STATUS[chat.status].label}
        </span>
      </div>

      <div
        ref={transcript}
        className="flex h-[22.5rem] flex-col gap-2 overflow-y-auto rounded-xl bg-ground p-4"
        aria-live="polite"
      >
        {chat.lines.length === 0 && (
          <p className="m-auto max-w-[16rem] text-center text-sm text-faint">
            {chat.call === "connecting"
              ? "Connecting to Asha…"
              : "Speak in the caller panel, or start a call and type."}
          </p>
        )}
        {chat.lines.map((line) => (
          <p
            key={line.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm ${BUBBLE[line.who]}`}
          >
            {line.via === "voice" && (
              <span className="mr-1" title="Spoken by the caller" aria-label="spoken">
                🎙
              </span>
            )}
            {line.text}
            {line.streaming && <span className="ml-0.5 animate-pulse">▍</span>}
          </p>
        ))}
        {chat.waiting && chat.lines.at(-1)?.who === "you" && (
          <p className="self-start rounded-2xl rounded-bl-sm bg-surface px-3.5 py-2 text-sm text-faint shadow-sm">
            Asha is typing…
          </p>
        )}
        {chat.call === "ended" && chat.lines.length > 0 && (
          <p className="self-center font-mono text-[11px] text-faint">Call ended</p>
        )}
      </div>

      {live ? (
        <div className="flex gap-2">
          <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
            <label htmlFor="asha-message" className="sr-only">
              Message Asha
            </label>
            <input
              id="asha-message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or type…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={!draft.trim() || chat.waiting}
              className="rounded-xl bg-ink px-4 text-sm font-semibold text-surface disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <button
            type="button"
            onClick={chat.endCall}
            className="rounded-xl border border-bad/40 px-4 text-sm font-semibold text-bad hover:bg-bad-soft"
          >
            End
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={chat.startCall}
          disabled={chat.status === "offline" || chat.call === "connecting"}
          className="rounded-xl bg-ink px-5 py-3.5 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          {chat.call === "ended" ? "Call again" : "Start call"}
        </button>
      )}
    </section>
  );
}
