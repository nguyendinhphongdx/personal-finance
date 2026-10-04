import { create } from "zustand";
import type { AgentContext } from "@/lib/agent/context";

interface AgentContextState {
  context: AgentContext | null;
  /** Pages call this when what the user is looking at changes. */
  setContext: (context: AgentContext) => void;
}

export const useAgentContextStore = create<AgentContextState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}));

/** Fired on window after the assistant changed data, so open pages can reload. */
export const AGENT_DATA_CHANGED = "agent:data-changed";
