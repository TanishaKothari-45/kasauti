import { VOICE_AGENT_URL, VOICE_AGENT_WS_URL } from "./config";

export type AgentHealth = {
  service: string;
  status: string;
  model: string;
  prompt: string;
  llm_key_set: boolean;
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
