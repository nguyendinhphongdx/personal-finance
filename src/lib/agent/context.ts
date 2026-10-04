/** What the user is looking at when they talk to the assistant. Shared by client and server. */
export interface AgentContext {
  route: string;
  propertyId?: string;
  propertyName?: string;
  activeTab?: string; // "rooms" | "tenants" | "billing" | "fees" | "info"
  month?: number;
  year?: number;
}

/** One tool run by the assistant, as shown in the chat UI. */
export interface AgentAction {
  tool: string;
  ok: boolean;
  summary: string;
  write: boolean;
  data?: unknown; // ids returned by write tools, replayed to the model so follow-ups can refer to them
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v ? v.slice(0, max) : undefined);
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/** Context comes from the client, so keep only known, well-formed fields. It is a hint, never an authorization. */
export function sanitizeContext(raw: unknown): AgentContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const route = str(r.route);
  if (!route) return null;
  return {
    route,
    propertyId: str(r.propertyId, 50),
    propertyName: str(r.propertyName),
    activeTab: str(r.activeTab, 20),
    month: int(r.month, 1, 12),
    year: int(r.year, 2000, 2100),
  };
}
