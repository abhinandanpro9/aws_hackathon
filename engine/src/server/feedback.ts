// Whether a parent found an answer helpful. The first real evidence for the whole bet.
// FLOW: parent taps a thumb -> recordFeedback -> operator sees which answers are landing
// 1. grouped by ROUTE, because the open question is whether an honest "I do not know" is
//    trusted more than a confident guess (docs/context.md, assumption B5)
// 2. one rating per conversation; a parent changing their mind replaces, never doubles
// 3. feedback NEVER changes an answer automatically -- it tells a human where to look
// WHY: we have shipped a system built on a claim about trust that nobody has tested

import type { AnswerRoute } from '../types/answer.js'

export interface FeedbackInput {
  readonly conversationId: string
  readonly route: AnswerRoute
  readonly helpful: boolean
  readonly note?: string
}

export interface RouteFeedback {
  readonly helpful: number
  readonly notHelpful: number
}

export interface FeedbackNote {
  readonly conversationId: string
  readonly route: AnswerRoute
  readonly note: string
  readonly at: string
}

export interface FeedbackSummary {
  readonly helpful: number
  readonly notHelpful: number
  readonly byRoute: Readonly<Record<string, RouteFeedback>>
  /** Conversations a parent marked unhelpful, so an operator can read what went wrong. */
  readonly unhelpfulIds: readonly string[]
  readonly notes: readonly FeedbackNote[]
}

interface Rating {
  readonly route: AnswerRoute
  readonly helpful: boolean
}

interface FeedbackStore {
  /** One rating per conversation. A second rating replaces the first. */
  ratings: Map<string, Rating>
  notes: FeedbackNote[]
}

const store: FeedbackStore = { ratings: new Map(), notes: [] }

/** Record what a parent thought. A repeat rating replaces the earlier one. */
export function recordFeedback(input: FeedbackInput): void {
  store.ratings.set(input.conversationId, { route: input.route, helpful: input.helpful })

  const note = input.note?.trim() ?? ''
  if (note.length > 0) {
    store.notes = [
      { conversationId: input.conversationId, route: input.route, note, at: new Date().toISOString() },
      ...store.notes,
    ]
  }
}

export function getFeedbackSummary(): FeedbackSummary {
  const byRoute: Record<string, RouteFeedback> = {}
  const unhelpfulIds: string[] = []
  let helpful = 0
  let notHelpful = 0

  for (const [conversationId, rating] of store.ratings) {
    const existing = byRoute[rating.route] ?? { helpful: 0, notHelpful: 0 }

    if (rating.helpful) {
      helpful += 1
      byRoute[rating.route] = { ...existing, helpful: existing.helpful + 1 }
    } else {
      notHelpful += 1
      unhelpfulIds.push(conversationId)
      byRoute[rating.route] = { ...existing, notHelpful: existing.notHelpful + 1 }
    }
  }

  return { helpful, notHelpful, byRoute, unhelpfulIds, notes: store.notes }
}

export function resetFeedback(): void {
  store.ratings = new Map()
  store.notes = []
}
