// The shapes the dashboard renders, and the topic list it offers.
// FLOW: engine API -> lib/api -> app-state maps to these -> components
// 1. this file holds types and constants only; there is no sample data anywhere in the app
// 2. topics mirror the engine's TOPIC_IDS, capitalised for display
// 3. an empty list means the engine has nothing yet, and the UI says so plainly

export type Outcome = "answered" | "person" | "none";

export interface UnansweredQuestion {
  id: string;
  question: string;
  timesAsked: number;
}

export interface ActivityItem {
  id: string;
  time: string;
  description: string;
  outcome: Outcome;
}

/**
 * One approved answer, as the operator screens show it.
 * Every policy has the same fields, whatever it is about, and reference is kept apart
 * from notes: a parent can be shown the reference, never the operator's remarks.
 */
export interface Policy {
  id: string;
  version: number;
  text: string;
  labels: string[];
  /** True when this must always reach a person, whatever the question looks like. */
  sensitive: boolean;
  owner?: string | null;
  /** Where this came from. A parent can check it. */
  reference: string;
  /** Operator commentary. Never shown to a parent. */
  notes: string;
  approvedBy: string;
  approvedOn: string;
  /** What an answer cites when it uses this policy: id@version. */
  citeAs: string;
  isNew?: boolean;
  /** How many times this policy has answered a parent. */
  timesUsed?: number;
  lastUsedAt?: string | null;
}

/**
 * A block of centre data the front desk can cite, shown alongside the prose policies.
 * Edited as fields rather than a sentence, because code computes over it: per-room hours,
 * an ordered illness ladder, a date-queryable closure list.
 */
export interface StructuredRecord {
  id: string;
  citeAs: string;
  title: string;
  topic: string;
  noteForOperator: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  lastReviewed: string | null;
  reviewedBy: string | null;
  facts: Record<string, unknown>;
}

export interface ReviewItem {
  id: string;
  passage: string;
  page?: number;
  section?: string;
  source: string;
  /** Capitalised for the dropdown. Empty when the model suggested nothing. */
  guessedTopic: string;
  /** The model's own words for why. Shown so an operator can judge the suggestion. */
  reason: string;
  /** 0-1. Low is normal and useful, not a failure. */
  confidence: number;
}

export interface ApprovedRow {
  id: string;
  topic: string;
  policy: string;
  source: string;
  approvedBy: string;
  date: string;
}

export interface ConversationMessage {
  time: string;
  question: string;
  answer: string | null;
  citation: string | null;
  outcome: Outcome;
  handledBy: string;
  /** The answer's paper trail: which tools ran, what each decided, what the citation check did. */
  trace: string[];
  /** What the run cost. Absent on messages recorded before metrics existed. */
  metrics?: { latencyMs: number; modelCalls: number; toolsUsed: string[] };
}

export interface Conversation {
  id: string;
  time: string;
  question: string;
  outcome: Outcome;
  handledBy: string;
  /** Engine topic id, when it classified one. Drives the "why a person" note. */
  topic?: string | null;
  answer: string | null;
  citation: string | null;
  /** How many messages the parent sent in this sitting. */
  messageCount?: number;
  /** The whole exchange, in order. */
  messages?: ConversationMessage[];
}

/** Mirrors the engine's TOPIC_IDS. Lowercase on the wire, capitalised here. */
export const TOPICS: string[] = [
  "Hours",
  "Closures",
  "Illness",
  "Medication",
  "Food",
  "Tuition",
  "Enrollment",
  "Tours",
  "Pickup",
  "Attendance",
  "Daily",
  "Sensitive",
];
