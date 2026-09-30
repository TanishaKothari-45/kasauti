import { CLINIC_API_URL } from "./config";

export type Health = { service: string; status: string };

async function getJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000), cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export const clinicApi = {
  health: () => getJSON<Health>(`${CLINIC_API_URL}/health`),
};
