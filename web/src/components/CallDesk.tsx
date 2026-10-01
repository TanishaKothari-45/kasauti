"use client";

import { useAshaChat } from "@/hooks/useAshaChat";
import { AshaPanel } from "./AshaPanel";
import { CallerPanel } from "./CallerPanel";

/** Caller (speech → text) on the left, Asha (text → reply) on the right. */
export function CallDesk() {
  const asha = useAshaChat();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <CallerPanel onTurn={(text) => asha.send(text, "voice")} />
      <AshaPanel chat={asha} />
    </div>
  );
}
