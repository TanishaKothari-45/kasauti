"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "denied";

/** Tap to start, tap to stop. Hands the finished clip to `onClip`. */
export function usePushToTalk(onClip: (clip: Blob, seconds: number) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const seconds = (performance.now() - startedAt.current) / 1000;
        onClip(new Blob(chunks, { type: rec.mimeType }), seconds);
      };
      recorder.current = rec;
      startedAt.current = performance.now();
      rec.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  }, [onClip]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    setState("idle");
  }, []);

  return { state, start, stop };
}
