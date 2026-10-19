// What a parent asks, and what comes back.
// FLOW: ParentQuestion -> sensitive gate -> model turns -> tool results -> AnswerResult
// 1. every result names how it was reached, so the operator view can show what happened
// 2. an answer without a citation is only allowed when nothing was claimed
// 3. sensitive questions never reach the model at all

import type { TopicId } from './knowledge.js'

/** One earlier turn, so a follow-up like "what about preschool" still makes sense. */
export interface HistoryTurn {
  readonly role: 'parent' | 'assistant'
  readonly text: string
}

export interface ParentQuestion {
  readonly text: string
  /** Model-written rolling summary of turns older than the verbatim window, if one exists. */
  readonly summary?: string
  /** Set when the parent picked a child, so hours can resolve to a program. */
  readonly programId?: string
  readonly askedAt?: string
  /** What was already said in this conversation, oldest first. */
  readonly history?: readonly HistoryTurn[]
}

/** How the answer was reached. Drives the operator's "what happened" view. */
export const ANSWER_ROUTES = ['rule', 'schedule', 'policy_lookup', 'known_gap', 'sensitive', 'unknown'] as const
export type AnswerRoute = (typeof ANSWER_ROUTES)[number]

export const ANSWER_OUTCOMES = ['answered', 'sent_to_person', 'no_answer'] as const
export type AnswerOutcome = (typeof ANSWER_OUTCOMES)[number]

export interface AnswerResult {
  readonly outcome: AnswerOutcome
  readonly route: AnswerRoute
  /** What the parent reads. */
  readonly message: string
  readonly citation: string | null
  /** Named person, when a human is taking it. */
  readonly routeTo: string | null
  readonly topic: TopicId | null
  /** Classification confidence. A placeholder until real traffic tunes it. */
  readonly confidence: number
  /** Which approved policy answered, when one did. Drives usage tracking. */
  readonly usedPolicyId?: string
  /** True when a topic was understood but no approved policy existed for it. */
  readonly nearMiss?: boolean
  /** Set when book_tour decided a booking may be made; the server layer performs the write. */
  readonly bookingMade?: { readonly date: string; readonly time: string }
  /**
   * True when a person now owns this question and the chat should stop.
   * FLOW: outcome is sent_to_person or no_answer -> handedOff -> the UI closes the composer
   * Continuing to chat after a handoff undermines it: the parent is told someone will get back
   * to them, then invited to keep asking a system that just said it could not help.
   */
  readonly handedOff: boolean
  /** For the operator log: what the system did and why. */
  readonly trace: readonly string[]
  /**
   * What the run cost and how it behaved. Reporting only -- nothing branches on it.
   * FLOW: pipeline measures -> AnswerResult -> the eval aggregates -> latency, cost, steps
   * Without this, "would this scale to thousands of centres" is a claim with no number.
   */
  readonly metrics?: RunMetrics
}

export interface RunMetrics {
  /** Wall clock for the whole question, including every model pass and tool call. */
  readonly latencyMs: number
  /** Model round trips. One is a straight answer; more means it used tools. */
  readonly modelCalls: number
  readonly inputTokens: number
  readonly outputTokens: number
  /** Tools in the order they ran, so an eval can check WHICH path produced the answer. */
  readonly toolsUsed: readonly string[]
}
