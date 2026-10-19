// The only module in the app that calls fetch.
// FLOW: chat -> askFrontDesk -> engine /api/ask -> reply rendered
// 1. no fallback answers. If the front desk is unreachable we say so and give the phone number,
//    rather than inventing a reply from a bundled copy of the handbook
// 2. sessionId groups a parent's questions so the operator sees one conversation, not many
// 3. handedOff means a named person owns this now, and the chat should stop

export type AskOutcome = "answered" | "sent_to_person" | "no_answer";
export type AskRoute =
  "rule" | "schedule" | "policy_lookup" | "known_gap" | "sensitive" | "unknown";

export interface AskResponse {
  conversationId: string;
  outcome: AskOutcome;
  route: AskRoute;
  message: string;
  citation: string | null;
  routeTo: string | null;

  /** True when a person now owns this question and the chat should end. */
  handedOff: boolean;
  /** Which approved policy answered, when one did. Looks up the text a parent can read. */
  usedPolicyId?: string;
  /** What the run cost, as the engine measured it. Absent on older records and fallbacks. */
  metrics?: { latencyMs: number };
  /** Which crew member did what, in order. Absent until the engine sends it. */
  agents?: AgentStep[];
  /** Set only when Max handed the question to a person. */
  notified?: { channel: string; to: string };
}

export type AgentId = "ava" | "lena" | "nora" | "theo" | "max" | "quill";

export interface AgentStep {
  agent: AgentId;
  /** Plain words, e.g. "Checked the fever rule: stay home". */
  action: string;
  tool?: string;
  /** The agent this step handed the question to. */
  handoffTo?: string;
  /** Offset from the start of the request. */
  ms: number;
}

/** An approved policy, exactly as the operator approved it. */
export interface ApprovedPolicy {
  id: string;
  version: number;
  text: string;
  labels: string[];
  /** Where this came from. This is the line a parent can check. */
  reference: string;
  approvedBy: string;
  approvedAt: string;
}

export interface StaffMember {
  name: string;
  role: string;
  phone: string;
}

export interface CenterInfo {
  name: string;
  phone: string;
  staff: StaffMember[];
}

export interface ContactDetails {
  name: string;
  role: string | null;
  phone: string | null;
  raw: string;
}

const DEFAULT_BASE_URL = "http://localhost:8787";

function getBaseUrl(): string {
  const fromEnv: string | undefined = import.meta.env["VITE_API_URL"] as string | undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE_URL;
}

/**
 * Shown when the engine is unreachable. Says so plainly rather than inventing an answer.
 * The phone number comes from /api/center; when that is unreachable too we say we cannot
 * reach the front desk WITHOUT printing a number we cannot vouch for.
 */
export function unreachable(phone: string | null): AskResponse {
  return {
    conversationId: "",
    outcome: "no_answer",
    route: "unknown",
    message:
      phone === null
        ? "I cannot reach the front desk right now. Please try again in a moment."
        : `I cannot reach the front desk right now. Please call ${phone}.`,
    citation: null,
    routeTo: null,
    handedOff: true,
  };
}

export async function askFrontDesk(
  question: string,
  sessionId: string,
  phone: string | null,
): Promise<AskResponse> {
  try {
    const response: Response = await fetch(`${getBaseUrl()}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, sessionId }),
    });
    if (!response.ok) throw new Error("bad_status");
    return (await response.json()) as AskResponse;
  } catch {
    return unreachable(phone);
  }
}

/** Tell the front desk whether an answer helped. Never blocks the parent on the result. */
export async function sendFeedback(
  conversationId: string,
  route: AskRoute,
  helpful: boolean,
  note?: string,
): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        route,
        helpful,
        ...(note !== undefined && note.length > 0 ? { note } : {}),
      }),
    });
  } catch {
    // A rating that does not send is not the parent's problem.
  }
}

/**
 * The approved policy behind an answer, so the sheet can show the real rule.
 * Returns null rather than substituting invented text when it cannot be found.
 */
export async function getPolicy(policyId: string): Promise<ApprovedPolicy | null> {
  // The answer cites id@version, so the version has to come off before matching. An
  // operator editing this policy since the answer was given moves the version, and the
  // sheet then shows nothing rather than wording that is no longer approved.
  const at = policyId.lastIndexOf("@");
  const id = at > 0 ? policyId.slice(0, at) : policyId;
  const version = at > 0 ? Number(policyId.slice(at + 1)) : null;

  try {
    const response: Response = await fetch(`${getBaseUrl()}/api/policies`);
    if (!response.ok) throw new Error("bad_status");
    const body = (await response.json()) as { policies?: ApprovedPolicy[] };
    return (
      body.policies?.find(
        (policy: ApprovedPolicy) =>
          policy.id === id && (version === null || policy.version === version),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export async function getCenter(): Promise<CenterInfo | null> {
  try {
    const response: Response = await fetch(`${getBaseUrl()}/api/center`);
    if (!response.ok) throw new Error("bad_status");
    return (await response.json()) as CenterInfo;
  } catch {
    return null;
  }
}

/** Parses "Rosa Delgado, Center Director ((541) 555-0142 ext. 1)". */
export function parseContact(routeTo: string): ContactDetails {
  const shape: RegExpMatchArray | null = routeTo.match(/^([^,]+),\s*([^(]+?)\s*\((.+)\)\s*$/);
  if (!shape) {
    return { name: routeTo, role: null, phone: null, raw: routeTo };
  }
  const name: string = shape[1] ?? routeTo;
  const role: string = shape[2] ?? "";
  const phone: string = shape[3] ?? "";
  return { name: name.trim(), role: role.trim(), phone: phone.trim(), raw: routeTo };
}

// One hand-off can carry several people, joined by " · " by the engine.
// FLOW: "Dana, Lead ((541)... ext. 3) · Rosa, Director ((541)... ext. 1)" -> one card each
export function parseContacts(routeTo: string): ContactDetails[] {
  return routeTo
    .split(" · ")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
    .map((piece) => parseContact(piece));
}

export function toTelHref(phone: string): string {
  const digits: string = phone.replace(/[^0-9]/g, "");
  const extension: RegExpMatchArray | null = phone.match(/ext\.?\s*(\d+)/i);
  if (extension && extension[1]) {
    const base: string = digits.slice(0, digits.length - extension[1].length);
    return `tel:+1${base},${extension[1]}`;
  }
  return `tel:+1${digits}`;
}
