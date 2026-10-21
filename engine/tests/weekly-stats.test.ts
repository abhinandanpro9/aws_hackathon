import { describe, expect, it } from 'vitest'
import { answeredThisWeek } from '../src/server/stats.js'
import type { ConversationRecord } from '../src/server/store.js'

// The dashboard's "time saved" stat rests on this count, so the count keeps to the week.
// FLOW: conversations -> answered outcome AND askedAt within 7 days of now -> a count
// 1. only answered counts: a hand-off saved a walk to the desk, not the operator's minutes
// 2. the boundary is seven days back from "now", passed in so tests never read the clock

function record(askedAt: string, outcome: ConversationRecord['outcome']): ConversationRecord {
  return {
    id: `c_${askedAt}_${outcome}`,
    sessionId: null,
    askedAt,
    question: 'q',
    outcome,
    route: 'schedule',
    answer: 'a',
    citation: null,
    handledBy: 'Front desk',
    topic: null,
    confidence: 1,
    trace: [],
  }
}

const NOW = '2026-08-25T12:00:00.000Z'

describe('answered-this-week', () => {
  it('counts an answered conversation from yesterday', () => {
    expect(answeredThisWeek([record('2026-08-24T12:00:00.000Z', 'answered')], NOW)).toBe(1)
  })

  it('ignores one answered eight days ago', () => {
    expect(answeredThisWeek([record('2026-08-17T11:00:00.000Z', 'answered')], NOW)).toBe(0)
  })

  it('ignores a hand-off from this week', () => {
    expect(answeredThisWeek([record('2026-08-24T12:00:00.000Z', 'sent_to_person')], NOW)).toBe(0)
  })

  it('ignores a record whose date does not parse', () => {
    expect(answeredThisWeek([record('not-a-date', 'answered')], NOW)).toBe(0)
  })
})
