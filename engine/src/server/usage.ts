// Which policies earn their keep, and which topics have nothing behind them.
// FLOW: an answer cites a policy -> recordPolicyUse -> the operator's usage view
// 1. a policy never cited is as informative as one cited often -- absence is the signal
// 2. a near miss is a topic a parent asked about with no approved policy behind it
// 3. questions are capped per entry, most recent kept, so one popular policy cannot grow forever
// WHY: this is the data that tells an operator where the next thirty seconds should go

import { MAX_TRACKED_QUESTIONS } from '../config/usage.js'

export interface PolicyUsage {
  readonly policyId: string
  readonly labels: readonly string[]
  readonly timesUsed: number
  readonly lastUsedAt: string | null
  /** Most recent parent wording that hit this policy. Newest first. */
  readonly questions: readonly string[]
}

export interface NearMiss {
  readonly topic: string
  readonly timesAsked: number
  readonly lastAskedAt: string | null
  readonly questions: readonly string[]
}

export interface UsageReport {
  readonly byPolicy: Readonly<Record<string, PolicyUsage>>
  readonly nearMisses: Readonly<Record<string, NearMiss>>
}

interface UsageStore {
  byPolicy: Record<string, PolicyUsage>
  nearMisses: Record<string, NearMiss>
}

const store: UsageStore = { byPolicy: {}, nearMisses: {} }

/** Newest first, capped. Keeps the wording an operator would actually want to read. */
function pushQuestion(existing: readonly string[], question: string): string[] {
  return [question, ...existing].slice(0, MAX_TRACKED_QUESTIONS)
}

/** Record that an approved policy answered a question. */
/**
 * Record that a policy answered a parent.
 * An answer cites id@version, but usage is keyed on the POLICY: an operator editing the
 * wording should not reset the count to zero on a policy that has answered fifty parents.
 */
export function recordPolicyUse(
  citedSource: string,
  labels: readonly string[],
  question: string,
): void {
  const at = citedSource.lastIndexOf('@')
  const policyId = at > 0 ? citedSource.slice(0, at) : citedSource
  const existing = store.byPolicy[policyId]

  store.byPolicy[policyId] = {
    policyId,
    labels,
    timesUsed: (existing?.timesUsed ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
    questions: pushQuestion(existing?.questions ?? [], question),
  }
}

/** Record that a topic was asked about with no approved policy behind it. */
export function recordNearMiss(topic: string, question: string): void {
  const existing = store.nearMisses[topic]

  store.nearMisses[topic] = {
    topic,
    timesAsked: (existing?.timesAsked ?? 0) + 1,
    lastAskedAt: new Date().toISOString(),
    questions: pushQuestion(existing?.questions ?? [], question),
  }
}

export function getUsage(): UsageReport {
  return { byPolicy: store.byPolicy, nearMisses: store.nearMisses }
}

export function resetUsage(): void {
  store.byPolicy = {}
  store.nearMisses = {}
}
