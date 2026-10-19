import type { AgentId } from "@/lib/api";

// The six crew members, as CONTRACT.md lists them. Kept here so the strip renders before
// the engine answers; the engine's GET /api/agents carries the same list.

export interface CrewMember {
  id: AgentId;
  name: string;
  role: string;
  color: string;
}

export const CREW: readonly CrewMember[] = [
  { id: "ava", name: "Ava", role: "Receptionist", color: "#7c3aed" },
  { id: "lena", name: "Lena", role: "Handbook", color: "#0ea5e9" },
  { id: "nora", name: "Nora", role: "Health", color: "#ef4444" },
  { id: "theo", name: "Theo", role: "Tours", color: "#f59e0b" },
  { id: "max", name: "Max", role: "Escalation", color: "#10b981" },
  { id: "quill", name: "Quill", role: "Policies", color: "#64748b" },
];

export function crewMember(id: string | undefined): CrewMember | undefined {
  return CREW.find((member: CrewMember) => member.id === id);
}

export const CREW_TEXT = {
  stripLabel: "Front desk crew",
  timelineHeading: "How the crew handled this",
  voiceOn: "Crew voices on",
  voiceOff: "Crew voices off",
  /** `to` arrives as "<person> (<role>)". */
  notified: (to: string): string => `Max passed this to ${to} — they'll get back to you.`,
} as const;

/** Time between timeline steps appearing, so each handoff can be seen. */
export const STEP_DELAY_MS = 300;
