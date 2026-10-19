// In-memory state for the prototype. One process, no database.
// FLOW: server boot -> seed from center.json -> mutated by operator actions -> read by both UIs
// 1. deliberately not persisted: this is a prototype, and a restart is a clean demo
// 2. the shapes here are the API contract the control panel reads
// 3. every approved entry carries who approved it, because that is the trust story

import centerData from '../../data/center.json' with { type: 'json' }
import type { AnswerResult, HistoryTurn, RunMetrics } from '../types/answer.js'
import type { Policy, TopicId } from '../types/knowledge.js'
import type { PendingChange } from '../types/changes.js'

export interface ConversationRecord {
  readonly id: string
  /** Groups messages from one parent sitting. Null when the caller sent none. */
  readonly sessionId: string | null
  readonly askedAt: string
  readonly question: string
  readonly outcome: AnswerResult['outcome']
  readonly route: AnswerResult['route']
  readonly answer: string
  readonly citation: string | null
  readonly handledBy: string
  readonly topic: TopicId | null
  readonly confidence: number
  readonly trace: readonly string[]
  /** What the run cost -- latency, tokens, model calls, tools. Absent on rows from before. */
  readonly metrics?: RunMetrics
}

interface Store {
  approved: Policy[]
  conversations: ConversationRecord[]
  changes: PendingChange[]
}

/**
 * The centre's own policies, in the one shape every policy uses.
 * Read straight from center.json: an operator adding a policy there needs no code change,
 * and nothing here has to know which field a particular topic keeps its sentence in.
 */
export function seedPolicies(): Policy[] {
  return centerData.policies.map((raw) => ({
    id: raw.id,
    version: raw.version,
    text: raw.text,
    labels: raw.labels,
    sensitive: raw.sensitive,
    ownerId: raw.owner_id ?? null,
    reference: raw.reference,
    notes: raw.notes,
    approvedBy: raw.approved_by,
    approvedAt: raw.approved_at,
  }))
}

const store: Store = {
  approved: seedPolicies(),
  conversations: [],
  changes: [],
}

export function getApproved(): readonly Policy[] {
  return store.approved
}

export function addApproved(entry: Policy): void {
  store.approved = [entry, ...store.approved]
}

/** Replace the whole policy set. Only applyChange should reach this. */
export function setApproved(policies: readonly Policy[]): void {
  store.approved = [...policies]
}

// ─── Pending changes ───

export function getChanges(): readonly PendingChange[] {
  return store.changes
}

export function addChange(change: PendingChange): void {
  store.changes = [change, ...store.changes]
}

export function findChange(id: string): PendingChange | undefined {
  return store.changes.find((c) => c.id === id)
}

export function replaceChange(change: PendingChange): void {
  const index = store.changes.findIndex((c) => c.id === change.id)
  if (index >= 0) store.changes[index] = change
}

/** Put everything back to a fresh demo state. */
export function resetAll(): void {
  store.approved = seedPolicies()
  store.conversations = []
  store.changes = []
}





export function getConversations(): readonly ConversationRecord[] {
  return store.conversations
}

export function recordConversation(record: ConversationRecord): void {
  store.conversations = [record, ...store.conversations]
}

/**
 * What was already said in this parent's sitting, oldest first.
 * FLOW: records (newest first, for the operator) -> reversed -> question/answer pairs -> the loop
 * A null session has no history: without an id we cannot tell two parents apart, and
 * guessing wrong would show one family another family's conversation.
 */
export function getHistoryFor(sessionId: string | null): readonly HistoryTurn[] {
  if (sessionId === null) return []

  return store.conversations
    .filter((record) => record.sessionId === sessionId)
    .reverse()
    .flatMap((record) => [
      { role: 'parent' as const, text: record.question },
      { role: 'assistant' as const, text: record.answer },
    ])
}

// ─── Threads ───

export interface ConversationThread {
  readonly sessionId: string
  readonly startedAt: string
  readonly firstQuestion: string
  readonly messageCount: number
  /** The outcome that needs attention, not the last one. */
  readonly outcome: AnswerResult['outcome']
  readonly handledBy: string
  readonly messages: readonly ConversationRecord[]
}

/** Worst-first, because that is what an operator needs to look at. */
const OUTCOME_SEVERITY: Record<AnswerResult['outcome'], number> = {
  no_answer: 3,
  sent_to_person: 2,
  answered: 1,
}

/**
 * Group messages into the sittings they came from.
 * A message with no session id is a thread of one, so nothing is hidden.
 */
export function getThreads(): readonly ConversationThread[] {
  const groups = new Map<string, ConversationRecord[]>()

  for (const record of store.conversations) {
    const key = record.sessionId ?? record.id
    const existing = groups.get(key)
    if (existing === undefined) groups.set(key, [record])
    else existing.push(record)
  }

  const threads: ConversationThread[] = []

  for (const [sessionId, records] of groups) {
    const ordered = [...records].sort((a, b) => a.askedAt.localeCompare(b.askedAt))
    const first = ordered[0]
    if (first === undefined) continue

    const worst = ordered.reduce((acc, r) =>
      OUTCOME_SEVERITY[r.outcome] > OUTCOME_SEVERITY[acc.outcome] ? r : acc,
    )

    threads.push({
      sessionId,
      startedAt: first.askedAt,
      firstQuestion: first.question,
      messageCount: ordered.length,
      outcome: worst.outcome,
      handledBy: worst.handledBy,
      messages: ordered,
    })
  }

  return threads.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
