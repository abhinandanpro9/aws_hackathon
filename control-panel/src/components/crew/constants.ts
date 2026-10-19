import type { ApiAgent } from "@/lib/api";

export const CREW_TEXTS = {
  heading: "Crew",
  intro: "Six agents run the front desk. A person approves every change to what they can say.",
  chartTitle: "Who does what",
  chartDescription: "The director is a person. The six agents below work for them.",
  directorName: "Director (human)",
  directorRole: "Approves every policy change",
  feedTitle: "Live activity",
  feedDescription: "What each agent did, newest first. Updates every 2 seconds.",
  feedEmpty: "No agent activity yet. Ask the front desk a question and it will show up here.",
  sponsorsTitle: "Sponsor tools",
  sponsorsDescription:
    "REAL means the tool is live. CACHED means a saved result. FALLBACK means a stand-in runs instead.",
  sponsorsUnknown: "The engine has not reported these yet.",
  notReported: "Not reported",
} as const;

/** The crew as the shared contract defines it. Shown until the engine's own list loads. */
export const FALLBACK_AGENTS: ApiAgent[] = [
  { id: "ava", name: "Ava", role: "Receptionist — greets, routes, words the answer", tool: "", color: "#7c3aed" },
  { id: "lena", name: "Lena", role: "Handbook keeper", tool: "lookup_policy, get_center_facts", color: "#0ea5e9" },
  { id: "nora", name: "Nora", role: "Health lead", tool: "check_attendance", color: "#ef4444" },
  { id: "theo", name: "Theo", role: "Enrollment & tours", tool: "book_tour", color: "#f59e0b" },
  { id: "max", name: "Max", role: "Escalation — hands off to a named person", tool: "escalate_to_person", color: "#10b981" },
  { id: "quill", name: "Quill", role: "Curator — drafts policies from gaps", tool: "/api/curator/draft", color: "#64748b" },
];

export const SPONSORS = [
  { key: "n8n", name: "n8n", job: "Tells a person when Max escalates" },
  { key: "rocketride", name: "RocketRide", job: "Agent runtime" },
  { key: "masky", name: "Masky", job: "Agent faces" },
  { key: "snyk", name: "Snyk", job: "Security scan" },
  { key: "prelint", name: "Prelint", job: "Code checks" },
] as const;
