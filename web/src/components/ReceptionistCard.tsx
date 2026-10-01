"use client";

import { useEffect, useRef, useState } from "react";
import { agentHealth, chatSocketUrl, type ServerMessage } from "@/lib/agent";

type Status = "checking" | "online" | "no-key" | "offline";
type CallState = "idle" | "connecting" | "live" | "ended";
type Line = { id: number; who: "asha" | "you" | "system"; text: string; streaming?: boolean };

const STATUS: Record<Status, { label: string; style: string }> = {
  checking: { label: "Connecting…", style: "bg-warn-soft text-warn" },
  online: { label: "Online", style: "bg-good-soft text-good" },
  "no-key": { label: "No LLM key", style: "bg-warn-soft text-warn" },
  offline: { label: "Offline", style: "bg-bad-soft text-bad" },
};

const BUBBLE: Record<Line["who"], string> = {
  asha: "self-start rounded-bl-sm bg-surface",
  you: "self-end rounded-br-sm bg-ink text-surface",
  system: "self-center bg-bad-soft text-bad text-xs",
};

let nextId = 0;

export function ReceptionistCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [call, setCall] = useState<CallState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  // Is Asha reachable? DevTools → Network → Fetch/XHR: GET :7860/health every 10 s.
  useEffect(() => {
    let alive = true;
    const check = () =>
      agentHealth()
        .then((h) => alive && setStatus(h.llm_key_set ? "online" : "no-key"))
        .catch(() => alive && setStatus("offline"));
    check();
    const id = setInterval(check, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight });
  }, [lines]);

  useEffect(() => () => socket.current?.close(), []);

  function handle(message: ServerMessage) {
    switch (message.type) {
      case "session":
        setCall("live");
        break;
      case "assistant_delta":
        setLines((prev) => {
          const last = prev.at(-1);
          if (last?.who === "asha" && last.streaming) {
            return [...prev.slice(0, -1), { ...last, text: last.text + message.text }];
          }
          return [...prev, { id: nextId++, who: "asha", text: message.text, streaming: true }];
        });
        break;
      case "assistant_done":
        setWaiting(false);
        setLines((prev) => {
          const last = prev.at(-1);
          if (last?.who === "asha" && last.streaming) {
            return [...prev.slice(0, -1), { ...last, text: message.text, streaming: false }];
          }
          return [...prev, { id: nextId++, who: "asha", text: message.text }];
        });
        break;
      case "error":
        setWaiting(false);
        setLines((prev) => [...prev, { id: nextId++, who: "system", text: message.message }]);
        break;
    }
  }

  function startCall() {
    setLines([]);
    setCall("connecting");
    // DevTools → Network → WS → /ws/chat → Messages shows every frame both ways.
    const ws = new WebSocket(chatSocketUrl());
    socket.current = ws;
    ws.onmessage = (event) => handle(JSON.parse(event.data) as ServerMessage);
    ws.onclose = () => {
      setCall("ended");
      setWaiting(false);
    };
    ws.onerror = () =>
      setLines((prev) => [
        ...prev,
        { id: nextId++, who: "system", text: "Couldn't reach Asha. Is `make agent` running?" },
      ]);
  }

  function endCall() {
    socket.current?.close();
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ type: "user_message", text }));
    setLines((prev) => [...prev, { id: nextId++, who: "you", text }]);
    setDraft("");
    setWaiting(true);
  }

  const live = call === "live";

  return (
    <section
      aria-label="Call the receptionist"
      className="flex flex-col gap-5 rounded-2xl border border-rule bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center gap-4">
        <div
          className="grid size-14 place-items-center rounded-full bg-gold-soft text-xl font-semibold text-gold"
          aria-hidden
        >
          आ
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold">Asha</span>
          <span className="text-sm text-muted">Clinic receptionist · हिंदी · English</span>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs ${STATUS[status].style}`}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {live ? "In call" : STATUS[status].label}
        </span>
      </div>

      <div
        ref={transcript}
        className="flex h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-ground p-4"
        aria-live="polite"
      >
        {lines.length === 0 && (
          <p className="m-auto max-w-[16rem] text-center text-sm text-faint">
            {call === "connecting"
              ? "Connecting to Asha…"
              : "Start a call and chat with Asha in Hindi, English or Hinglish."}
          </p>
        )}
        {lines.map((line) => (
          <p
            key={line.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm ${BUBBLE[line.who]}`}
          >
            {line.text}
            {line.streaming && <span className="ml-0.5 animate-pulse">▍</span>}
          </p>
        ))}
        {waiting && lines.at(-1)?.who === "you" && (
          <p className="self-start rounded-2xl rounded-bl-sm bg-surface px-3.5 py-2 text-sm text-faint shadow-sm">
            Asha is typing…
          </p>
        )}
        {call === "ended" && lines.length > 0 && (
          <p className="self-center font-mono text-[11px] text-faint">Call ended</p>
        )}
      </div>

      {live ? (
        <div className="flex flex-col gap-2">
          <form onSubmit={send} className="flex gap-2">
            <label htmlFor="asha-message" className="sr-only">
              Message Asha
            </label>
            <input
              id="asha-message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your message…"
              autoComplete="off"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={!draft.trim() || waiting}
              className="rounded-xl bg-ink px-4 text-sm font-semibold text-surface disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <button
            type="button"
            onClick={endCall}
            className="rounded-xl border border-bad/40 px-4 py-2.5 text-sm font-semibold text-bad hover:bg-bad-soft"
          >
            End call
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCall}
          disabled={status === "offline" || call === "connecting"}
          className="flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>●</span> {call === "ended" ? "Call again" : "Start call"}
        </button>
      )}
      <p className="-mt-2 text-center text-xs text-faint">
        Text chat for now. Voice switches on in Day 4.
      </p>
    </section>
  );
}
