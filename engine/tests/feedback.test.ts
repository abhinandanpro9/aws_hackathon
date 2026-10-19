import { beforeEach, describe, expect, it } from 'vitest'
import { getFeedbackSummary, recordFeedback, resetFeedback } from '../src/server/feedback.js'

// Parents say whether an answer helped. The first real evidence for or against the whole bet.
// FLOW: parent taps thumb -> recordFeedback -> operator sees which answers are landing
// 1. grouped by route, so we learn whether an honest "I do not know" is trusted (assumption B5)
// 2. a thumbs down on a rule answer is the most important signal in the system
// 3. feedback is never used to change an answer automatically; it tells a human where to look

beforeEach(() => {
  resetFeedback()
})

describe('recordFeedback', () => {
  it('counts a helpful answer', () => {
    recordFeedback({ conversationId: 'c1', route: 'policy_lookup', helpful: true })
    expect(getFeedbackSummary().helpful).toBe(1)
  })

  it('counts an unhelpful answer', () => {
    recordFeedback({ conversationId: 'c1', route: 'policy_lookup', helpful: false })
    expect(getFeedbackSummary().notHelpful).toBe(1)
  })

  it('lets a parent change their mind without double counting', () => {
    recordFeedback({ conversationId: 'c1', route: 'policy_lookup', helpful: true })
    recordFeedback({ conversationId: 'c1', route: 'policy_lookup', helpful: false })
    const summary = getFeedbackSummary()
    expect(summary.helpful).toBe(0)
    expect(summary.notHelpful).toBe(1)
  })

  it('keeps a note when the parent leaves one', () => {
    recordFeedback({ conversationId: 'c1', route: 'known_gap', helpful: false, note: 'I still do not know' })
    expect(getFeedbackSummary().notes[0]?.note).toBe('I still do not know')
  })
})

describe('feedback grouped by route - this is what tests the bet', () => {
  it('reports how honest non-answers were received', () => {
    recordFeedback({ conversationId: 'c1', route: 'known_gap', helpful: true })
    recordFeedback({ conversationId: 'c2', route: 'known_gap', helpful: true })
    recordFeedback({ conversationId: 'c3', route: 'known_gap', helpful: false })
    expect(getFeedbackSummary().byRoute['known_gap']?.helpful).toBe(2)
    expect(getFeedbackSummary().byRoute['known_gap']?.notHelpful).toBe(1)
  })

  it('separates a rule answer from a policy lookup', () => {
    recordFeedback({ conversationId: 'c1', route: 'rule', helpful: false })
    recordFeedback({ conversationId: 'c2', route: 'policy_lookup', helpful: true })
    expect(getFeedbackSummary().byRoute['rule']?.notHelpful).toBe(1)
    expect(getFeedbackSummary().byRoute['policy_lookup']?.helpful).toBe(1)
  })

  it('reports nothing for a route nobody rated', () => {
    expect(getFeedbackSummary().byRoute['sensitive']).toBeUndefined()
  })
})

describe('what needs attention', () => {
  it('surfaces unhelpful answers so an operator can read them', () => {
    recordFeedback({ conversationId: 'c1', route: 'rule', helpful: false })
    recordFeedback({ conversationId: 'c2', route: 'rule', helpful: true })
    expect(getFeedbackSummary().unhelpfulIds).toEqual(['c1'])
  })

  it('drops an id from the unhelpful list when the parent changes to helpful', () => {
    recordFeedback({ conversationId: 'c1', route: 'rule', helpful: false })
    recordFeedback({ conversationId: 'c1', route: 'rule', helpful: true })
    expect(getFeedbackSummary().unhelpfulIds).toHaveLength(0)
  })
})

describe('resetFeedback', () => {
  it('clears everything', () => {
    recordFeedback({ conversationId: 'c1', route: 'rule', helpful: true })
    resetFeedback()
    expect(getFeedbackSummary().helpful).toBe(0)
  })
})
