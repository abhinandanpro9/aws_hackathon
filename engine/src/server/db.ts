// D1-backed state. Same accessors the in-memory store had, now async.
// FLOW: request -> withDb(env) -> prepared statement -> row -> the shape the API contract expects
// 1. the module-level object this replaces was per-isolate on Workers: an operator approved a
//    policy and a later request could land in an isolate where it never happened
// 2. labels/questions/trace/before/after are JSON text -- read whole, never queried into
// 3. seq preserves newest-first ordering, which the in-memory arrays got free from unshift
// 4. raw prepared statements, no ORM

import centerData from '../../data/center.json' with { type: 'json' }
import type { AnswerResult, HistoryTurn, RunMetrics } from '../types/answer.js'
import type { Policy } from '../types/knowledge.js'
import type { PendingChange, PolicySnapshot } from '../types/changes.js'
import type { ConversationRecord, ConversationThread } from './store.js'
import type { AgentId, AgentStep } from '../lib/agents.js'

export interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>
      all<T = unknown>(): Promise<{ results: T[] }>
      run(): Promise<unknown>
    }
    first<T = unknown>(): Promise<T | null>
    all<T = unknown>(): Promise<{ results: T[] }>
    run(): Promise<unknown>
  }
  batch(statements: unknown[]): Promise<unknown>
}

// ─── Row shapes ───

interface PolicyRow {
  id: string
  version: number
  text: string
  labels: string
  sensitive: number
  owner_id: string | null
  reference: string
  notes: string
  approved_by: string
  approved_at: string
}

interface ChangeRow {
  id: string
  kind: string
  target_id: string | null
  before: string | null
  after: string | null
  proposed_by: string
  proposed_at: string
  note: string
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
}

interface ConversationRow {
  id: string
  session_id: string | null
  asked_at: string
  question: string
  outcome: string
  route: string
  answer: string
  citation: string | null
  handled_by: string
  topic: string | null
  confidence: number
  trace: string
  metrics: string | null
}

// ─── Row -> domain ───

function toPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    version: row.version,
    text: row.text,
    labels: JSON.parse(row.labels) as string[],
    sensitive: row.sensitive === 1,
    ownerId: row.owner_id,
    reference: row.reference,
    notes: row.notes,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
  }
}

function toChange(row: ChangeRow): PendingChange {
  return {
    id: row.id,
    kind: row.kind as PendingChange['kind'],
    targetId: row.target_id,
    before: row.before === null ? null : (JSON.parse(row.before) as PolicySnapshot),
    after: row.after === null ? null : (JSON.parse(row.after) as PolicySnapshot),
    proposedBy: row.proposed_by,
    proposedAt: row.proposed_at,
    note: row.note,
    status: row.status as PendingChange['status'],
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  }
}

function toConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    askedAt: row.asked_at,
    question: row.question,
    outcome: row.outcome as AnswerResult['outcome'],
    route: row.route as AnswerResult['route'],
    answer: row.answer,
    citation: row.citation,
    handledBy: row.handled_by,
    topic: row.topic as ConversationRecord['topic'],
    confidence: row.confidence,
    trace: JSON.parse(row.trace) as string[],
    ...(row.metrics === null || row.metrics === undefined
      ? {}
      : { metrics: JSON.parse(row.metrics) as RunMetrics }),
  }
}

// ─── Seeding ───

/**
 * Put the 45 policies from center.json into an empty database.
 * Idempotent by design: a non-empty policies table is left alone, so a redeploy never
 * duplicates the set or overwrites an operator's approved edit.
 * FLOW: boot -> count policies -> 0 ? insert all : return
 */
export async function seedIfEmpty(db: D1Like): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM policies').first<{ n: number }>()
  // 0 means "already had policies, seeded nothing" -- the caller logs only a real seed.
  if (row !== null && row.n > 0) return 0

  const statements = centerData.policies.map((raw, index) =>
    db
      .prepare(
        `INSERT INTO policies
           (id, version, text, labels, sensitive, owner_id, reference, notes, approved_by, approved_at, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        raw.id,
        raw.version,
        raw.text,
        JSON.stringify(raw.labels),
        raw.sensitive ? 1 : 0,
        raw.owner_id ?? null,
        raw.reference,
        raw.notes,
        raw.approved_by,
        raw.approved_at,
        // Descending so the seeded order survives a newest-first read.
        centerData.policies.length - index,
      ),
  )

  await db.batch(statements)

  // A fresh centre also starts with the handbook drafts waiting for review, so the
  // approval queue is a working surface on first open, not an empty box.
  const drafts = (centerData as { draft_policies?: readonly SeedDraft[] }).draft_policies ?? []
  if (drafts.length > 0) {
    await db.batch(
      drafts.map((draft, index) =>
        db
          .prepare(
            `INSERT INTO changes
               (id, kind, target_id, before, after, proposed_by, proposed_at, note, status, reviewed_by, reviewed_at, seq)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            draft.change_id,
            'create',
            null,
            null,
            JSON.stringify({
              text: draft.text,
              labels: draft.labels,
              sensitive: draft.sensitive,
              ownerId: null,
              reference: draft.reference,
              notes: '',
            }),
            draft.proposed_by,
            draft.proposed_at,
            draft.note,
            'pending',
            null,
            null,
            index + 1,
          ),
      ),
    )
  }

  return statements.length
}

/** A handbook draft awaiting review, seeded verbatim from live. */
interface SeedDraft {
  readonly change_id: string
  readonly text: string
  readonly labels: readonly string[]
  readonly sensitive: boolean
  readonly reference: string
  readonly note: string
  readonly proposed_by: string
  readonly proposed_at: string
}

// ─── Policies ───

export async function getApproved(db: D1Like): Promise<readonly Policy[]> {
  const { results } = await db
    .prepare('SELECT * FROM policies ORDER BY seq DESC')
    .all<PolicyRow>()
  return results.map(toPolicy)
}

async function nextSeq(db: D1Like, table: 'policies' | 'changes' | 'conversations'): Promise<number> {
  const row = await db.prepare(`SELECT COALESCE(MAX(seq), 0) AS n FROM ${table}`).first<{ n: number }>()
  return (row?.n ?? 0) + 1
}

/**
 * Replace the whole policy set, atomically.
 * FLOW: applyChange returns the new set -> delete all -> insert all, in ONE batch
 * A delete that commits without its inserts would empty the centre's policies, so the two
 * halves never travel separately.
 */
export async function setApproved(db: D1Like, policies: readonly Policy[]): Promise<void> {
  await db.batch(statementsForSetApproved(db, policies))
}

/** The statements only, so an approval can commit the policy set and its change row together. */
export function statementsForSetApproved(db: D1Like, policies: readonly Policy[]): unknown[] {
  const total = policies.length
  return [
    db.prepare('DELETE FROM policies'),
    ...policies.map((p, index) =>
      db
        .prepare(
          `INSERT INTO policies
             (id, version, text, labels, sensitive, owner_id, reference, notes, approved_by, approved_at, seq)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          p.id,
          p.version,
          p.text,
          JSON.stringify(p.labels),
          p.sensitive ? 1 : 0,
          p.ownerId,
          p.reference,
          p.notes,
          p.approvedBy,
          p.approvedAt,
          total - index,
        ),
    ),
  ]
}

// ─── Pending changes ───

export async function getChanges(db: D1Like): Promise<readonly PendingChange[]> {
  const { results } = await db.prepare('SELECT * FROM changes ORDER BY seq DESC').all<ChangeRow>()
  return results.map(toChange)
}

export async function findChange(db: D1Like, id: string): Promise<PendingChange | undefined> {
  const row = await db.prepare('SELECT * FROM changes WHERE id = ?').bind(id).first<ChangeRow>()
  return row === null ? undefined : toChange(row)
}

export async function addChange(db: D1Like, change: PendingChange): Promise<void> {
  const seq = await nextSeq(db, 'changes')
  await insertChangeStatement(db, change, seq).run()
}

function insertChangeStatement(db: D1Like, change: PendingChange, seq: number) {
  return db
    .prepare(
      `INSERT INTO changes
         (id, kind, target_id, before, after, proposed_by, proposed_at, note, status, reviewed_by, reviewed_at, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      change.id,
      change.kind,
      change.targetId,
      change.before === null ? null : JSON.stringify(change.before),
      change.after === null ? null : JSON.stringify(change.after),
      change.proposedBy,
      change.proposedAt,
      change.note,
      change.status,
      change.reviewedBy,
      change.reviewedAt,
      seq,
    )
}

export function replaceChangeStatement(db: D1Like, change: PendingChange) {
  return db
    .prepare(
      `UPDATE changes
          SET kind = ?, target_id = ?, before = ?, after = ?, proposed_by = ?, proposed_at = ?,
              note = ?, status = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?`,
    )
    .bind(
      change.kind,
      change.targetId,
      change.before === null ? null : JSON.stringify(change.before),
      change.after === null ? null : JSON.stringify(change.after),
      change.proposedBy,
      change.proposedAt,
      change.note,
      change.status,
      change.reviewedBy,
      change.reviewedAt,
      change.id,
    )
}

export async function replaceChange(db: D1Like, change: PendingChange): Promise<void> {
  await replaceChangeStatement(db, change).run()
}

/**
 * Apply an approved change: the new policy set and the change row commit together.
 * WHY: sequential awaits can half-commit -- a change marked approved whose policy never
 * landed, or a policy set with no record of who approved it.
 */
export async function commitApproval(
  db: D1Like,
  policies: readonly Policy[],
  change: PendingChange,
): Promise<void> {
  await db.batch([...statementsForSetApproved(db, policies), replaceChangeStatement(db, change)])
}

// ─── Conversations ───

export async function getConversations(db: D1Like): Promise<readonly ConversationRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM conversations ORDER BY seq DESC')
    .all<ConversationRow>()
  return results.map(toConversation)
}

export async function recordConversation(db: D1Like, record: ConversationRecord): Promise<void> {
  const seq = await nextSeq(db, 'conversations')
  await db
    .prepare(
      `INSERT INTO conversations
         (id, session_id, asked_at, question, outcome, route, answer, citation, handled_by, topic, confidence, trace, metrics, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.sessionId,
      record.askedAt,
      record.question,
      record.outcome,
      record.route,
      record.answer,
      record.citation,
      record.handledBy,
      record.topic,
      record.confidence,
      JSON.stringify(record.trace),
      record.metrics === undefined ? null : JSON.stringify(record.metrics),
      seq,
    )
    .run()
}

/**
 * What was already said in this parent's sitting, oldest first.
 * A null session has no history: without an id we cannot tell two parents apart, and
 * guessing wrong would show one family another family's conversation.
 */
export async function getHistoryFor(
  db: D1Like,
  sessionId: string | null,
): Promise<readonly HistoryTurn[]> {
  if (sessionId === null) return []

  const { results } = await db
    .prepare('SELECT * FROM conversations WHERE session_id = ? ORDER BY seq ASC')
    .bind(sessionId)
    .all<ConversationRow>()

  return results.flatMap((row) => [
    { role: 'parent' as const, text: row.question },
    { role: 'assistant' as const, text: row.answer },
  ])
}

// ─── Reset ───

/**
 * Put everything back to a fresh demo state.
 * FLOW: delete every mutable table in ONE batch -> reseed the 45 policies -> return the count
 * The deletes travel together: a partial reset would leave conversations pointing at policies
 * that no longer exist.
 */
// ─── Session summaries ───

export interface SessionSummary {
  readonly summary: string
  readonly turnsCovered: number
}

/** The rolling summary for a session, or null before the first overflow. */
export async function getSessionSummary(db: D1Like, sessionId: string): Promise<SessionSummary | null> {
  const { results } = await db
    .prepare('SELECT * FROM session_summaries WHERE session_id = ?')
    .bind(sessionId)
    .all<{ summary: string; turns_covered: number }>()
  // Last row wins: real D1 replaces on the primary key, the memory store appends.
  const row = results[results.length - 1]
  return row === undefined ? null : { summary: row.summary, turnsCovered: Number(row.turns_covered) }
}

/** Store the updated rolling summary and how many turns it now covers. */
export async function saveSessionSummary(
  db: D1Like,
  sessionId: string,
  summary: string,
  turnsCovered: number,
): Promise<void> {
  await db
    .prepare(
      'INSERT OR REPLACE INTO session_summaries (session_id, summary, turns_covered, updated_at) VALUES (?, ?, ?, ?)',
    )
    .bind(sessionId, summary, turnsCovered, new Date().toISOString())
    .run()
}

// ─── Tour bookings ───

/** Taken tour slots, read once per message so tools never touch the store. */
export async function getBookings(db: D1Like): Promise<readonly { date: string; time: string }[]> {
  const { results } = await db
    .prepare('SELECT date, time FROM bookings')
    .all<{ date: string; time: string }>()
  return results
}

/** Hold a slot. The UNIQUE(date, time) constraint is the last word on double-booking. */
export async function addBooking(db: D1Like, date: string, time: string): Promise<void> {
  await db
    .prepare('INSERT INTO bookings (id, date, time, created_at) VALUES (?, ?, ?, ?)')
    .bind(`b_${date}_${time}`, date, time, new Date().toISOString())
    .run()
}

export async function resetAll(db: D1Like): Promise<number> {
  await db.batch([
    db.prepare('DELETE FROM policies'),
    db.prepare('DELETE FROM changes'),
    db.prepare('DELETE FROM conversations'),
    db.prepare('DELETE FROM policy_usage'),
    db.prepare('DELETE FROM near_misses'),
    db.prepare('DELETE FROM feedback'),
    db.prepare('DELETE FROM activity'),
  ])
  // The table is empty by construction, so this always seeds and always returns the real count.
  return seedIfEmpty(db)
}

// ─── Agent activity ───

interface ActivityRow {
  id: string
  ts: number
  at: string
  question: string
  agent: string
  action: string
  tool: string | null
  handoff_to: string | null
  ms: number
  demo?: number
  a2a?: string | null
}

export interface ActivityEvent extends AgentStep {
  readonly question: string
  readonly at: string
  /** Set only when the step came from a demo- session. */
  readonly demo?: true
}

/** Write one answer's steps. ts keeps them in step order inside the same millisecond. */
export async function recordActivity(
  db: D1Like,
  steps: readonly AgentStep[],
  question: string,
  at: string,
  demo = false,
): Promise<void> {
  if (steps.length === 0) return
  const base = Date.now() * 100
  await db.batch(
    steps.map((step, index) =>
      db
        .prepare(
          'INSERT INTO activity (id, ts, at, question, agent, action, tool, handoff_to, ms, demo, a2a) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          `a_${base + index}_${Math.floor(Math.random() * 1e6).toString(36)}`,
          base + index,
          at,
          question,
          step.agent,
          step.action,
          step.tool ?? null,
          step.handoffTo ?? null,
          step.ms,
          demo ? 1 : 0,
          step.a2a === undefined ? null : JSON.stringify(step.a2a),
        ),
    ),
  )
}

/**
 * Newest question first; inside one question, the steps in the order they happened.
 * FLOW: newest rows by ts -> group by question (ts / 100) -> at DESC, group DESC, step ASC
 * Plain ts DESC read one question backwards: Max before Nora before Ava.
 */
export async function getActivity(db: D1Like, limit: number): Promise<ActivityEvent[]> {
  const { results } = await db
    .prepare('SELECT * FROM activity ORDER BY ts DESC LIMIT ?')
    .bind(limit)
    .all<ActivityRow>()
  const group = (row: ActivityRow): number => Math.floor(Number(row.ts) / 100)
  const ordered = results.slice(0, limit).sort(
    (a, b) => b.at.localeCompare(a.at) || group(b) - group(a) || Number(a.ts) - Number(b.ts),
  )
  return ordered.map((row) => ({
    agent: row.agent as AgentId,
    action: row.action,
    ...(row.tool === null || row.tool === undefined ? {} : { tool: row.tool }),
    ...(row.handoff_to === null || row.handoff_to === undefined ? {} : { handoffTo: row.handoff_to as AgentId }),
    ms: row.ms,
    question: row.question,
    at: row.at,
    ...(Number(row.demo ?? 0) === 1 ? { demo: true as const } : {}),
    ...(typeof row.a2a === 'string' ? { a2a: JSON.parse(row.a2a) as NonNullable<AgentStep['a2a']> } : {}),
  }))
}

export type { ConversationThread }
