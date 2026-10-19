import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// The date-aware branches of the schedule rules, reachable from the tools that front them.
// FLOW: model works out YYYY-MM-DD -> tool validates it -> the rule's date branch answers
// 1. answerHours and answerTours both handle a date -- the weekend answer, the "no tours
//    that day, the next one is" answer -- and NEITHER tool passed one, so those branches
//    were reachable only from tests. Asked about Saturday hours, the live system stated
//    weekday hours for a day the centre is closed.
// 2. the date goes through readDate like check_closures: an unreadable one asks again,
//    it never reaches the rule.

describe('get_hours takes the day into account', () => {
  it('says weekend when the date is one', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours', programId: 'toddler', date: '2026-08-29' })

    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('weekend')
  })

  it('answers weekday hours as before when no date is given', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours', programId: 'toddler' })

    expect(result.answer).toContain('5:30pm')
  })

  it('asks again on a date it cannot read', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours', programId: 'toddler', date: 'saturday' })

    expect(result.outcome).toBe('needs_detail')
  })
})

describe('get_tours takes the day into account', () => {
  it('names the next tour day when the asked day has none', () => {
    // 2026-09-02 is a Wednesday; tours run Tuesday and Thursday.
    const result = getCenterFactsTool.execute({ topic: 'tours', date: '2026-09-02' })

    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('next')
  })

  it('confirms a day that has tours', () => {
    // 2026-09-01 is a Tuesday.
    const result = getCenterFactsTool.execute({ topic: 'tours', date: '2026-09-01' })

    expect(result.answer).toContain('Tuesday')
  })

  it('asks again on a date it cannot read', () => {
    const result = getCenterFactsTool.execute({ topic: 'tours', date: 'friday' })

    expect(result.outcome).toBe('needs_detail')
  })
})
