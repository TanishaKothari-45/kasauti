import { VOICE_AGENT_URL, VOICE_AGENT_WS_URL } from "./config";

export type AgentHealth = {
  service: string;
  status: string;
  model: string;
  prompt: string;
  llm_key_set: boolean;
  stt_default: SttProvider;
  stt_providers: SttProvider[];
};

/** Messages the server sends on /ws/chat. */
export type ServerMessage =
  | { type: "session"; session_id: string; prompt: string }
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; text: string }
  | { type: "error"; message: string };

export async function agentHealth(): Promise<AgentHealth> {
  const response = await fetch(`${VOICE_AGENT_URL}/health`, {
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<AgentHealth>;
}

export const chatSocketUrl = () => `${VOICE_AGENT_WS_URL}/ws/chat`;
export const offerUrl = () => `${VOICE_AGENT_URL}/api/offer`;

export type SttLanguage = "auto" | "hi" | "en";
export type SttProvider = "local" | "groq";

export type Transcript = {
  text: string;
  language: string | null;
  audio_seconds: number;
  latency_ms: number;
  model: string;
  provider: SttProvider;
};

/** Push-to-talk: DevTools → Network → Fetch/XHR → `stt` shows the upload and the JSON reply. */
export async function transcribe(
  audio: Blob,
  language: SttLanguage,
  provider: SttProvider,
): Promise<Transcript> {
  const form = new FormData();
  form.append("audio", audio, audio.type.includes("mp4") ? "clip.mp4" : "clip.webm");
  form.append("language", language);
  form.append("provider", provider);
  const response = await fetch(`${VOICE_AGENT_URL}/stt`, { method: "POST", body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<Transcript>;
}
