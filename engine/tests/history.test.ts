import { beforeEach, describe, expect, it } from 'vitest'
import { getHistoryFor, recordConversation, resetAll } from '../src/server/store.js'

// What the parent already said, so a follow-up makes sense.
// FLOW: earlier turns recorded -> getHistoryFor(sessionId) -> oldest first -> the loop
// 1. records are stored newest first for the operator view; history needs the opposite
// 2. one parent's sitting never leaks into another's, so it is keyed on the session
// 3. an unhanded-off answer and the question that earned it are both carried

const record = (sessionId: string, question: string, answer: string) => {
  recordConversation({
    id: `c_${question.slice(0, 6)}`,
    sessionId,
    askedAt: '2026-08-24T10:00:00.000Z',
    question,
    outcome: 'answered',
    route: 'policy_lookup',
    answer,
    citation: null,
    handledBy: 'Front desk',
    topic: null,
    confidence: 1,
    trace: [],
  })
}

describe('conversation history', () => {
  beforeEach(() => {
    resetAll()
  })

  it('is empty for a session that has said nothing', () => {
    expect(getHistoryFor('new-session')).toEqual([])
  })

  it('carries both what the parent asked and what we answered', () => {
    record('s1', 'what time do you close', 'Which room is your child in?')

    expect(getHistoryFor('s1')).toEqual([
      { role: 'parent', text: 'what time do you close' },
      { role: 'assistant', text: 'Which room is your child in?' },
    ])
  })

  it('returns turns oldest first, however they were stored', () => {
    record('s1', 'first question', 'first answer')
    record('s1', 'second question', 'second answer')

    expect(getHistoryFor('s1').map((turn) => turn.text)).toEqual([
      'first question',
      'first answer',
      'second question',
      'second answer',
    ])
  })

  it('never mixes one parent conversation into another', () => {
    record('s1', 'mine', 'yours')
    record('s2', 'theirs', 'ours')

    expect(getHistoryFor('s1').map((turn) => turn.text)).toEqual(['mine', 'yours'])
  })

  it('has no history for a question asked without a session', () => {
    record('s1', 'mine', 'yours')
    expect(getHistoryFor(null)).toEqual([])
  })
})
