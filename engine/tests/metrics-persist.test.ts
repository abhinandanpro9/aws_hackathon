import { describe, expect, it } from 'vitest'
import { memoryDb } from '../src/server/memory-db.js'
import { getConversations, recordConversation } from '../src/server/db.js'
import type { ConversationRecord } from '../src/server/store.js'

// What a question cost, stored beside what was said.
// FLOW: answerQuestion measures -> recordConversation -> conversations.metrics (JSON)
// 1. the trace said WHICH tools ran; nothing said what the run cost. Latency, tokens and the
//    tool list now land in one JSON column, read whole like trace -- future views (per-tool
//    timing, cost per day) read it without a schema change.
// 2. optional on the way in and null for old rows: a record without metrics is a record,
//    not an error.

const RECORD: ConversationRecord = {
  id: 'c_test1',
  sessionId: 's1',
  askedAt: '2026-08-25T10:00:00Z',
  question: 'q',
  outcome: 'answered',
  route: 'schedule',
  answer: 'a',
  citation: null,
  handledBy: 'Front desk',
  topic: null,
  confidence: 1,
  trace: ['t'],
  metrics: {
    latencyMs: 1234,
    modelCalls: 2,
    inputTokens: 4000,
    outputTokens: 60,
    toolsUsed: ['get_hours'],
  },
}

describe('run metrics persist with the conversation', () => {
  it('stores and reads them back', async () => {
    const db = memoryDb()
    await recordConversation(db, RECORD)

    const [stored] = await getConversations(db)
    expect(stored?.metrics?.latencyMs).toBe(1234)
    expect(stored?.metrics?.toolsUsed).toEqual(['get_hours'])
  })

  it('tolerates a record with no metrics', async () => {
    const db = memoryDb()
    const { metrics: _metrics, ...bare } = RECORD
    await recordConversation(db, { ...bare, id: 'c_test2' })

    const [stored] = await getConversations(db)
    expect(stored?.metrics).toBeUndefined()
  })
})
