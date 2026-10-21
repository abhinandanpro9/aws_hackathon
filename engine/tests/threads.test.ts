import { beforeEach, describe, expect, it } from 'vitest'
import { getThreads, recordConversation, resetAll } from '../src/server/store.js'
import type { ConversationRecord } from '../src/server/store.js'

// A parent asks several things in one sitting. The operator should see the sitting, not the parts.
// FLOW: parent chat sends a sessionId -> records grouped by it -> operator opens one thread
// 1. records without a session id are still shown, each as a thread of one
// 2. messages inside a thread stay in the order they were asked
// 3. a thread's outcome is the worst one in it, because that is what needs attention

function record(over: Partial<ConversationRecord>): ConversationRecord {
  return {
    id: `c_${Math.random().toString(36).slice(2)}`,
    sessionId: null,
    askedAt: '2026-08-24T09:00:00.000Z',
    question: 'a question',
    outcome: 'answered',
    route: 'policy_lookup',
    answer: 'an answer',
    citation: null,
    handledBy: 'Front desk',
    topic: 'food',
    confidence: 0.9,
    trace: [],
    ...over,
  }
}

beforeEach(() => {
  resetAll()
})

describe('getThreads', () => {
  it('groups messages sharing a session id', () => {
    recordConversation(record({ sessionId: 's1', question: 'first' }))
    recordConversation(record({ sessionId: 's1', question: 'second' }))
    expect(getThreads()).toHaveLength(1)
    expect(getThreads()[0]?.messages).toHaveLength(2)
  })

  it('keeps messages in the order they were asked', () => {
    recordConversation(record({ sessionId: 's1', question: 'first', askedAt: '2026-08-24T09:00:00.000Z' }))
    recordConversation(record({ sessionId: 's1', question: 'second', askedAt: '2026-08-24T09:01:00.000Z' }))
    expect(getThreads()[0]?.messages[0]?.question).toBe('first')
  })

  it('separates different sessions', () => {
    recordConversation(record({ sessionId: 's1' }))
    recordConversation(record({ sessionId: 's2' }))
    expect(getThreads()).toHaveLength(2)
  })

  it('treats a message with no session as its own thread', () => {
    recordConversation(record({ sessionId: null }))
    recordConversation(record({ sessionId: null }))
    expect(getThreads()).toHaveLength(2)
  })

  it('counts the messages in a thread', () => {
    recordConversation(record({ sessionId: 's1' }))
    recordConversation(record({ sessionId: 's1' }))
    recordConversation(record({ sessionId: 's1' }))
    expect(getThreads()[0]?.messageCount).toBe(3)
  })

  it('shows the first question as the thread heading', () => {
    recordConversation(record({ sessionId: 's1', question: 'what time do you close', askedAt: '2026-08-24T09:00:00.000Z' }))
    recordConversation(record({ sessionId: 's1', question: 'and on fridays', askedAt: '2026-08-24T09:01:00.000Z' }))
    expect(getThreads()[0]?.firstQuestion).toBe('what time do you close')
  })
})

describe('a thread reports the outcome that needs attention', () => {
  it('reports no answer when any message went unanswered', () => {
    recordConversation(record({ sessionId: 's1', outcome: 'answered' }))
    recordConversation(record({ sessionId: 's1', outcome: 'no_answer' }))
    expect(getThreads()[0]?.outcome).toBe('no_answer')
  })

  it('prefers no answer over sent to a person', () => {
    recordConversation(record({ sessionId: 's1', outcome: 'sent_to_person' }))
    recordConversation(record({ sessionId: 's1', outcome: 'no_answer' }))
    expect(getThreads()[0]?.outcome).toBe('no_answer')
  })

  it('reports sent to a person over answered', () => {
    recordConversation(record({ sessionId: 's1', outcome: 'answered' }))
    recordConversation(record({ sessionId: 's1', outcome: 'sent_to_person' }))
    expect(getThreads()[0]?.outcome).toBe('sent_to_person')
  })

  it('reports answered when everything was answered', () => {
    recordConversation(record({ sessionId: 's1', outcome: 'answered' }))
    recordConversation(record({ sessionId: 's1', outcome: 'answered' }))
    expect(getThreads()[0]?.outcome).toBe('answered')
  })
})

describe('threads are newest first', () => {
  it('puts the most recent thread at the top', () => {
    recordConversation(record({ sessionId: 'old', askedAt: '2026-08-24T08:00:00.000Z' }))
    recordConversation(record({ sessionId: 'new', askedAt: '2026-08-24T10:00:00.000Z' }))
    expect(getThreads()[0]?.sessionId).toBe('new')
  })
})
