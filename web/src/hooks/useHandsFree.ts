"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { offerUrl, type SttLanguage, type SttProvider } from "@/lib/agent";

export type ListenState = "off" | "connecting" | "listening" | "error";
export type TurnEvent = {
  id: number;
  at: number; // seconds since listening started
  kind: "turn-start" | "segment" | "turn-end";
  text?: string;
};

/** Sent by the server's TurnAssembler once Smart Turn decides the caller is done. */
type UserTurnMessage = { type: "user-turn"; text: string; segments: number };

function isUserTurn(data: unknown): data is UserTurnMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "user-turn" &&
    typeof (data as { text?: unknown }).text === "string"
  );
}

let nextId = 0;

/**
 * Hands-free: the mic streams to the server over WebRTC. The server decides everything:
 * where speech starts and stops (Silero VAD), the text of each segment (Whisper), when the
 * caller's turn is over (Smart Turn), and the full text of that turn (TurnAssembler).
 * This hook only displays the events and passes each finished turn to `onTurn`.
 */
export function useHandsFree(onTurn: (text: string) => void) {
  const [state, setState] = useState<ListenState>("off");
  const [events, setEvents] = useState<TurnEvent[]>([]);
  const client = useRef<PipecatClient | null>(null);
  const t0 = useRef(0);
  const onTurnRef = useRef(onTurn);

  useEffect(() => {
    onTurnRef.current = onTurn;
  }, [onTurn]);

  const log = useCallback((kind: TurnEvent["kind"], text?: string) => {
    const at = (performance.now() - t0.current) / 1000;
    setEvents((prev) => [...prev.slice(-40), { id: nextId++, at, kind, text }]);
  }, []);

  const stop = useCallback(async () => {
    await client.current?.disconnect();
    client.current = null;
    setState("off");
  }, []);

  const start = useCallback(
    async (language: SttLanguage, provider: SttProvider) => {
      setEvents([]);
      setState("connecting");
      const pc = new PipecatClient({
        transport: new SmallWebRTCTransport(),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onUserStartedSpeaking: () => log("turn-start"),
          // One per speech segment: progress only, never sent to Asha on its own.
          onUserTranscript: (data) => {
            if (data.final && data.text.trim()) log("segment", data.text.trim());
          },
          // One per finished turn: the joined text of every segment in it.
          onServerMessage: (data: unknown) => {
            if (!isUserTurn(data)) return;
            log("turn-end", data.text);
            onTurnRef.current(data.text);
          },
          onDisconnected: () => setState("off"),
          onError: () => setState("error"),
        },
      });
      client.current = pc;
      try {
        // DevTools → Network → Fetch/XHR → `offer` is the WebRTC handshake (POST, then PATCH for ICE).
        await pc.connect({
          webrtcRequestParams: { endpoint: offerUrl(), requestData: { language, provider } },
        });
        t0.current = performance.now();
        setState("listening");
      } catch {
        setState("error");
        client.current = null;
      }
    },
    [log],
  );

  useEffect(() => () => void client.current?.disconnect(), []);

  return { state, events, start, stop };
}
