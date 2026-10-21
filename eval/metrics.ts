// What a run costs and how it behaves, alongside whether it was right.
// FLOW: trials -> latency percentiles, token cost, tool trajectory, confusion matrix
// 1. correctness says whether to ship; these say whether it is affordable and how it behaves
// 2. p95 not just an average: a mean hides the one parent in twenty waiting eight seconds
// 3. every number here is measured, never modelled -- pricing is the one input from outside

import type { AnswerResult } from '../engine/src/types/answer.js'
import type { EvalCase } from './cases.js'

/**
 * Public gemini-3.7-flash pricing, USD per million tokens.
 * The one number here that is not measured. If pricing moves, this moves.
 */
export const PRICE_PER_MILLION = { input: 0.3, output: 2.5 } as const

export function costOf(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_PER_MILLION.input +
    (outputTokens / 1_000_000) * PRICE_PER_MILLION.output
  )
}

// ─── Latency ───

/**
 * The value below which `fraction` of runs fall.
 * Nearest-rank on a sorted copy: with 54 samples an interpolated percentile invents a number
 * that no run actually took.
 */
export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(fraction * sorted.length)
  return sorted[Math.min(Math.max(rank - 1, 0), sorted.length - 1)] ?? 0
}

// ─── Tool trajectory ───

/**
 * Did the run use the tools the case expected, in any order?
 * FLOW: expected tools -> how many appeared in the trajectory -> fraction
 * Order is deliberately NOT asserted. A question answered correctly by a route we did not
 * imagine is still answered correctly; grading the path punishes a valid one.
 * A case with no expectation scores null and is left out of the average rather than
 * counted as a pass, which would quietly inflate it.
 */
export function trajectoryScore(
  expected: readonly string[] | undefined,
  used: readonly string[],
): number | null {
  if (expected === undefined || expected.length === 0) return null
  const actual = new Set(used)
  const hit = expected.filter((tool) => actual.has(tool)).length
  return hit / expected.length
}

// ─── Precision and recall, per outcome ───

export interface Confusion {
  readonly truePositive: number
  readonly falsePositive: number
  readonly falseNegative: number
}

/**
 * Per outcome: how often it claimed this outcome and was right, versus missed it.
 * Precision answers "when it escalated, should it have?". Recall answers "of everything that
 * needed escalating, how much did it catch?". A front desk can look excellent on one while
 * failing the other, and the two failures are not equally bad here: a missed escalation is a
 * safety incident, an unnecessary one is a phone call.
 */
export function confusionFor(
  outcome: string,
  pairs: readonly { expected: string; actual: string }[],
): Confusion {
  return {
    truePositive: pairs.filter((p) => p.expected === outcome && p.actual === outcome).length,
    falsePositive: pairs.filter((p) => p.expected !== outcome && p.actual === outcome).length,
    falseNegative: pairs.filter((p) => p.expected === outcome && p.actual !== outcome).length,
  }
}

export function precision(c: Confusion): number {
  const claimed = c.truePositive + c.falsePositive
  return claimed === 0 ? 0 : c.truePositive / claimed
}

export function recall(c: Confusion): number {
  const actual = c.truePositive + c.falseNegative
  return actual === 0 ? 0 : c.truePositive / actual
}

// ─── Aggregate ───

export interface RunTotals {
  readonly latencyP50: number
  readonly latencyP95: number
  readonly latencyMax: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalCostUsd: number
  readonly costPerQuestionUsd: number
  readonly avgModelCalls: number
  readonly trajectoryAvg: number | null
  readonly measured: number
}

export function totalsFrom(
  results: readonly (AnswerResult | null)[],
  cases: readonly EvalCase[],
): RunTotals {
  const byIndex = results.map((result, index) => ({ result, testCase: cases[index] }))
  const measured = byIndex.filter((x) => x.result?.metrics !== undefined)

  const latencies = measured.map((x) => x.result?.metrics?.latencyMs ?? 0)
  const inputTokens = measured.reduce((sum, x) => sum + (x.result?.metrics?.inputTokens ?? 0), 0)
  const outputTokens = measured.reduce((sum, x) => sum + (x.result?.metrics?.outputTokens ?? 0), 0)
  const modelCalls = measured.reduce((sum, x) => sum + (x.result?.metrics?.modelCalls ?? 0), 0)

  const trajectories = measured
    .map((x) => trajectoryScore(x.testCase?.expectTools, x.result?.metrics?.toolsUsed ?? []))
    .filter((score): score is number => score !== null)

  const totalCost = costOf(inputTokens, outputTokens)

  return {
    latencyP50: percentile(latencies, 0.5),
    latencyP95: percentile(latencies, 0.95),
    latencyMax: latencies.length === 0 ? 0 : Math.max(...latencies),
    inputTokens,
    outputTokens,
    totalCostUsd: totalCost,
    costPerQuestionUsd: measured.length === 0 ? 0 : totalCost / measured.length,
    avgModelCalls: measured.length === 0 ? 0 : modelCalls / measured.length,
    trajectoryAvg:
      trajectories.length === 0
        ? null
        : trajectories.reduce((a, b) => a + b, 0) / trajectories.length,
    measured: measured.length,
  }
}
