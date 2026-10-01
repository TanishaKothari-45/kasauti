"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentHealth, chatSocketUrl, type ServerMessage } from "@/lib/agent";

export type AgentStatus = "checking" | "online" | "no-key" | "offline";
export type CallState = "idle" | "connecting" | "live" | "ended";
export type ChatLine = {
  id: number;
  who: "asha" | "you" | "system";
  text: string;
  via?: "voice";
  streaming?: boolean;
};

export interface AshaChat {
  status: AgentStatus;
  call: CallState;
  lines: ChatLine[];
  waiting: boolean;
  startCall: () => void;
  endCall: () => void;
  /** Sends now if the call is live; otherwise starts a call and sends once it connects. */
  send: (text: string, via?: "voice") => void;
}

let nextId = 0;

export function useAshaChat(): AshaChat {
  const [status, setStatus] = useState<AgentStatus>("checking");
  const [call, setCall] = useState<CallState>("idle");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [waiting, setWaiting] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<{ text: string; via?: "voice" }[]>([]);

  // DevTools → Network → Fetch/XHR: GET :7860/health every 10 s.
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

  useEffect(() => () => socket.current?.close(), []);

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: nextId++ }]);
  }, []);

  const transmit = useCallback(
    (text: string, via?: "voice") => {
      socket.current?.send(JSON.stringify({ type: "user_message", text }));
      push({ who: "you", text, via });
      setWaiting(true);
    },
    [push],
  );

  const handle = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "session":
          setCall("live");
          pending.current.splice(0).forEach(({ text, via }) => transmit(text, via));
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
          push({ who: "system", text: message.message });
          break;
      }
    },
    [push, transmit],
  );

  const startCall = useCallback(() => {
    if (socket.current && socket.current.readyState <= WebSocket.OPEN) return;
    setLines([]);
    setCall("connecting");
    // DevTools → Network → WS → chat → Messages shows every frame both ways.
    const ws = new WebSocket(chatSocketUrl());
    socket.current = ws;
    ws.onmessage = (event) => handle(JSON.parse(event.data) as ServerMessage);
    ws.onclose = () => {
      setCall("ended");
      setWaiting(false);
      socket.current = null;
    };
    ws.onerror = () => push({ who: "system", text: "Couldn't reach Asha. Is `make agent` running?" });
  }, [handle, push]);

  const endCall = useCallback(() => socket.current?.close(), []);

  const send = useCallback(
    (text: string, via?: "voice") => {
      const clean = text.trim();
      if (!clean) return;
      if (socket.current?.readyState === WebSocket.OPEN && call === "live") {
        transmit(clean, via);
      } else {
        pending.current.push({ text: clean, via });
        startCall();
      }
    },
    [call, startCall, transmit],
  );

  return { status, call, lines, waiting, startCall, endCall, send };
}
