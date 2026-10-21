// Usage and feedback, on D1. Same reports the in-memory versions produced.
// FLOW: an answer cites a policy -> recordPolicyUse -> the operator's usage view
// 1. a policy never cited is as informative as one cited often -- absence is the signal
// 2. usage is keyed on the POLICY, not id@version: editing wording must not reset a count
// 3. questions are capped per row, newest kept, so one popular policy cannot grow forever

import { MAX_TRACKED_QUESTIONS } from '../config/usage.js'
import type { D1Like } from './db.js'
import type { AnswerRoute } from '../types/answer.js'
import type { FeedbackInput, FeedbackNote, FeedbackSummary, RouteFeedback } from './feedback.js'
import type { NearMiss, PolicyUsage, UsageReport } from './usage.js'

interface UsageRow {
  policy_id: string
  labels: string
  times_used: number
  last_used_at: string | null
  questions: string
}

interface NearMissRow {
  topic: string
  times_asked: number
  last_asked_at: string | null
  questions: string
}

interface FeedbackRow {
  conversation_id: string
  route: string
  helpful: number
  note: string | null
  at: string
}

/** Newest first, capped. Keeps the wording an operator would actually want to read. */
function pushQuestion(existing: readonly string[], question: string): string[] {
  return [question, ...existing].slice(0, MAX_TRACKED_QUESTIONS)
}

// ─── Usage ───

/**
 * Record that a policy answered a parent.
 * An answer cites id@version, but usage is keyed on the POLICY: an operator editing the
 * wording should not reset the count to zero on a policy that has answered fifty parents.
 */
export async function recordPolicyUse(
  db: D1Like,
  citedSource: string,
  labels: readonly string[],
  question: string,
  now: string,
): Promise<void> {
  const at = citedSource.lastIndexOf('@')
  const policyId = at > 0 ? citedSource.slice(0, at) : citedSource

  const existing = await db
    .prepare('SELECT * FROM policy_usage WHERE policy_id = ?')
    .bind(policyId)
    .first<UsageRow>()

  const questions = pushQuestion(
    existing === null ? [] : (JSON.parse(existing.questions) as string[]),
    question,
  )

  await db
    .prepare(
      `INSERT INTO policy_usage (policy_id, labels, times_used, last_used_at, questions)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(policy_id) DO UPDATE SET
         labels = excluded.labels,
         times_used = policy_usage.times_used + 1,
         last_used_at = excluded.last_used_at,
         questions = excluded.questions`,
    )
    .bind(policyId, JSON.stringify(labels), 1, now, JSON.stringify(questions))
    .run()
}

/** Record that a topic was asked about with no approved policy behind it. */
export async function recordNearMiss(
  db: D1Like,
  topic: string,
  question: string,
  now: string,
): Promise<void> {
  const existing = await db
    .prepare('SELECT * FROM near_misses WHERE topic = ?')
    .bind(topic)
    .first<NearMissRow>()

  const questions = pushQuestion(
    existing === null ? [] : (JSON.parse(existing.questions) as string[]),
    question,
  )

  await db
    .prepare(
      `INSERT INTO near_misses (topic, times_asked, last_asked_at, questions)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(topic) DO UPDATE SET
         times_asked = near_misses.times_asked + 1,
         last_asked_at = excluded.last_asked_at,
         questions = excluded.questions`,
    )
    .bind(topic, 1, now, JSON.stringify(questions))
    .run()
}

export async function getUsage(db: D1Like): Promise<UsageReport> {
  const usage = await db.prepare('SELECT * FROM policy_usage').all<UsageRow>()
  const misses = await db.prepare('SELECT * FROM near_misses').all<NearMissRow>()

  const byPolicy: Record<string, PolicyUsage> = {}
  for (const row of usage.results) {
    byPolicy[row.policy_id] = {
      policyId: row.policy_id,
      labels: JSON.parse(row.labels) as string[],
      timesUsed: row.times_used,
      lastUsedAt: row.last_used_at,
      questions: JSON.parse(row.questions) as string[],
    }
  }

  const nearMisses: Record<string, NearMiss> = {}
  for (const row of misses.results) {
    nearMisses[row.topic] = {
      topic: row.topic,
      timesAsked: row.times_asked,
      lastAskedAt: row.last_asked_at,
      questions: JSON.parse(row.questions) as string[],
    }
  }

  return { byPolicy, nearMisses }
}

// ─── Feedback ───

/**
 * One rating per conversation.
 * A parent changing their mind replaces the rating, never doubles it -- so the row is keyed
 * on the conversation and upserts.
 */
export async function recordFeedback(
  db: D1Like,
  input: FeedbackInput,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO feedback (conversation_id, route, helpful, note, at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         route = excluded.route,
         helpful = excluded.helpful,
         note = excluded.note,
         at = excluded.at`,
    )
    .bind(input.conversationId, input.route, input.helpful ? 1 : 0, input.note ?? null, now)
    .run()
}

/**
 * Grouped by ROUTE, because the open question is whether an honest "I do not know" is
 * trusted more than a confident guess.
 */
export async function getFeedbackSummary(db: D1Like): Promise<FeedbackSummary> {
  const { results } = await db.prepare('SELECT * FROM feedback').all<FeedbackRow>()

  const byRoute: Record<string, RouteFeedback> = {}
  const notes: FeedbackNote[] = []
  // Conversations a parent marked unhelpful, so an operator can read what went wrong.
  const unhelpfulIds: string[] = []
  let helpful = 0
  let notHelpful = 0

  for (const row of results) {
    const existing = byRoute[row.route] ?? { helpful: 0, notHelpful: 0 }

    if (row.helpful === 1) {
      helpful += 1
      byRoute[row.route] = { helpful: existing.helpful + 1, notHelpful: existing.notHelpful }
    } else {
      notHelpful += 1
      unhelpfulIds.push(row.conversation_id)
      byRoute[row.route] = { helpful: existing.helpful, notHelpful: existing.notHelpful + 1 }
    }

    if (row.note !== null && row.note.trim().length > 0) {
      notes.push({
        conversationId: row.conversation_id,
        route: row.route as AnswerRoute,
        note: row.note,
        at: row.at,
      })
    }
  }

  return {
    helpful,
    notHelpful,
    byRoute,
    unhelpfulIds,
    notes: notes.sort((a, b) => b.at.localeCompare(a.at)),
  }
}
