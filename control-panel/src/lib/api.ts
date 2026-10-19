// The only place this app talks to the engine.
// FLOW: component -> useAppState -> this client -> engine API -> store
// 1. no raw fetch in components, ever -- one client, one base url
// 2. every call degrades to a typed empty result, so a dead API shows an empty UI, not a crash
// 3. shapes here mirror the engine's types; keep them in step

const BASE_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:8787";

export interface ApiProvenance {
  page: number | null;
  sectionPath: string[];
  line: number;
  precision: string;
  label: string;
}

/** One approved answer. Every policy has these fields, whatever it is about. */
export interface ApiPolicy {
  id: string;
  version: number;
  text: string;
  labels: string[];
  /** True when this must always reach a person, whatever the question looks like. */
  sensitive: boolean;
  ownerId: string | null;
  /** Where this came from. A parent can check it. */
  reference: string;
  /** Operator commentary. Never shown to a parent. */
  notes: string;
  approvedBy: string;
  approvedAt: string;
  /** What an answer cites when it uses this policy: id@version. */
  citeAs: string;
  kind: string;
  editedAs: string;
}

/**
 * A block of centre data the front desk can cite -- hours, closures, tours, the illness rule.
 * Not prose: code computes over these, so an operator edits fields rather than a sentence.
 */
/** A proposed change sitting in the review queue. Nothing takes effect until approved. */
export interface ApiChange {
  id: string;
  kind: "create" | "edit" | "archive";
  targetId: string | null;
  before: {
    text: string;
    labels: string[];
    sensitive: boolean;
    reference: string;
    notes: string;
  } | null;
  after: {
    text: string;
    labels: string[];
    sensitive: boolean;
    reference: string;
    notes: string;
  } | null;
  proposedBy: string;
  proposedAt: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface ApiStructuredRecord {
  id: string;
  citeAs: string;
  kind: string;
  title: string;
  topic: string;
  editedAs: string;
  noteForOperator: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerRole: string | null;
  lastReviewed: string | null;
  reviewedBy: string | null;
  facts: Record<string, unknown>;
}

export interface ApiConversation {
  id: string;
  askedAt: string;
  question: string;
  outcome: "answered" | "sent_to_person" | "no_answer";
  route: string;
  answer: string;
  citation: string | null;
  handledBy: string;
  topic: string | null;
  confidence: number;
  trace: string[];
  /** What the run cost. Absent on rows written before it was recorded. */
  metrics?: {
    latencyMs: number;
    modelCalls: number;
    inputTokens: number;
    outputTokens: number;
    toolsUsed: string[];
  };
}

export interface ApiStaff {
  id: string;
  name: string;
  role: string;
  phone: string;
  ext: string;
}

export interface ApiCenter {
  name: string;
  phone: string;
  staff: ApiStaff[];
}

export interface ApiPolicyUsage {
  policyId: string;
  labels: string[];
  text: string;
  timesUsed: number;
  lastUsedAt: string | null;
  questions: string[];
}

export interface ApiNearMiss {
  topic: string;
  timesAsked: number;
  lastAskedAt: string | null;
  questions: string[];
}

export interface ApiUsage {
  policies: ApiPolicyUsage[];
  neverUsed: number;
  nearMisses: ApiNearMiss[];
}

export interface ApiThread {
  sessionId: string;
  startedAt: string;
  firstQuestion: string;
  messageCount: number;
  outcome: "answered" | "sent_to_person" | "no_answer";
  handledBy: string;
  messages: ApiConversation[];
}

export interface ApiStats {
  answered: number;
  answeredThisWeek?: number;
  sentToPerson: number;
  noAnswer: number;
  total: number;
  awaitingApproval: number;
  unanswered: { question: string; timesAsked: number }[];
}

export interface ApiAnswer {
  outcome: "answered" | "sent_to_person" | "no_answer";
  route: string;
  message: string;
  citation: string | null;
  routeTo: string | null;
  topic: string | null;
  confidence: number;
  trace: string[];
}

export type AgentId = "ava" | "lena" | "nora" | "theo" | "max" | "quill";

export interface ApiAgent {
  id: string;
  name: string;
  role: string;
  tool: string;
  color: string;
}

/** One thing an agent did on a question, as the activity feed reports it. */
export interface ApiActivity {
  agent: string;
  action: string;
  tool?: string;
  handoffTo?: string;
  ms?: number;
  question?: string;
  at?: string;
}

export type SponsorMode = "REAL" | "CACHED" | "FALLBACK";

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  async health(): Promise<{ ok: boolean; center: string; model: string | null } | null> {
    return request("/api/health");
  },

  async ask(question: string): Promise<ApiAnswer | null> {
    return request("/api/ask", { method: "POST", body: JSON.stringify({ question }) });
  },

  async center(): Promise<ApiCenter | null> {
    return request("/api/center");
  },

  /** Everything the front desk can cite: approved prose, plus the centre's structured facts. */
  async policies(): Promise<{ policies: ApiPolicy[]; structured: ApiStructuredRecord[] }> {
    const data = await request<{ policies: ApiPolicy[]; structured: ApiStructuredRecord[] }>(
      "/api/policies",
    );
    return { policies: data?.policies ?? [], structured: data?.structured ?? [] };
  },

  /** The tour schedule and every held slot, for the Tours view. */
  async bookings(): Promise<{
    schedule: { days: string[]; times: string[]; durationMinutes: number };
    bookings: { date: string; time: string }[];
  } | null> {
    return request("/api/bookings");
  },

  /** Paste handbook text; the engine extracts drafts into the approval queue. */
  async extractDrafts(text: string): Promise<{ proposed: number; found: number } | null> {
    return request<{ proposed: number; found: number }>("/api/extract", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  async addPolicy(input: {
    text: string;
    labels: string[];
    sensitive: boolean;
    reference?: string;
    notes?: string;
    ownerId?: string | null;
  }): Promise<ApiPolicy | null> {
    const data = await request<{ policy: ApiPolicy }>("/api/policies", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data?.policy ?? null;
  },

  async editPolicy(
    id: string,
    input: {
      text: string;
      labels: string[];
      sensitive: boolean;
      reference?: string;
      notes?: string;
    },
  ): Promise<boolean> {
    const data = await request<{ ok: boolean }>(`/api/policies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return data?.ok ?? false;
  },

  async archivePolicy(id: string): Promise<boolean> {
    const data = await request<{ ok: boolean }>(`/api/policies/${id}`, { method: "DELETE" });
    return data?.ok ?? false;
  },

  /** The review queue. A change is only live once someone approves it. */
  async changes(): Promise<ApiChange[]> {
    const data = await request<{ changes: ApiChange[] }>("/api/changes");
    return data?.changes ?? [];
  },

  async approveChange(id: string, reviewer?: string): Promise<boolean> {
    const data = await request<{ change: ApiChange }>(`/api/changes/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewer }),
    });
    return data !== null;
  },

  async rejectChange(id: string, reviewer?: string): Promise<boolean> {
    const data = await request<{ change: ApiChange }>(`/api/changes/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reviewer }),
    });
    return data !== null;
  },

  async conversations(): Promise<{ conversations: ApiConversation[]; threads: ApiThread[] }> {
    const data = await request<{ conversations: ApiConversation[]; threads: ApiThread[] }>(
      "/api/conversations",
    );
    return { conversations: data?.conversations ?? [], threads: data?.threads ?? [] };
  },

  async usage(): Promise<ApiUsage | null> {
    return request("/api/usage");
  },

  async stats(): Promise<ApiStats | null> {
    return request("/api/stats");
  },

  async agents(): Promise<ApiAgent[] | null> {
    const data = await request<{ agents: ApiAgent[] }>("/api/agents");
    return data?.agents ?? null;
  },

  async activity(limit = 50): Promise<ApiActivity[]> {
    const data = await request<{ activity?: ApiActivity[]; events?: ApiActivity[] }>(
      `/api/activity?limit=${limit}`,
    );
    return data?.activity ?? data?.events ?? [];
  },

  /** Each sponsor tool and whether it is really wired up. Null when the engine does not say. */
  async sponsors(): Promise<Record<string, { mode: SponsorMode }> | null> {
    const data = await request<{ sponsors: Record<string, { mode: SponsorMode }> }>(
      "/api/sponsors",
    );
    return data?.sponsors ?? null;
  },

  /** Quill drafts one policy from an unanswered question. It lands in the approval queue. */
  async curatorDraft(question: string): Promise<ApiChange | null> {
    const data = await request<ApiChange | { change: ApiChange }>("/api/curator/draft", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    if (data === null) return null;
    return "change" in data ? data.change : data;
  },
};
