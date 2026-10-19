import { describe, expect, it } from 'vitest'
import { answerClosure } from '../src/rules/schedule.js'
import centerData from '../data/center.json' with { type: 'json' }

// The published list is the authority. Not on it and not a weekend means open.
// FLOW: date -> published holiday? -> weekend? -> open
// 1. no fourth branch that guesses. Every closure answer comes from a date in the list or
//    from the weekday, both decided in code from data
// 2. this is deterministic on purpose: a parent asking the same date twice gets the same
//    answer, and an operator can point at the row that produced it

describe('closures are decided by the published list, nothing else', () => {
  it('answers open on a federal holiday the centre did not publish', () => {
    // Veterans Day, 11 Nov 2026, a Wednesday. Not on the list, so the centre is open.
    const answer = answerClosure({ ask: 'specific_day', date: '2026-11-11' })

    expect(answer.kind).toBe('answered')
    expect(answer.message.toLowerCase()).toContain('open')
  })

  it('answers closed on a published holiday', () => {
    const answer = answerClosure({ ask: 'specific_day', date: '2026-09-07' })

    expect(answer.kind).toBe('answered')
    expect(answer.message).toContain('Labor Day')
  })

  it('answers closed at a weekend', () => {
    const answer = answerClosure({ ask: 'specific_day', date: '2026-08-09' })

    expect(answer.kind).toBe('answered')
    expect(answer.message.toLowerCase()).toContain('weekend')
  })

  it('answers open on an ordinary weekday', () => {
    const answer = answerClosure({ ask: 'specific_day', date: '2026-08-26' })

    expect(answer.kind).toBe('answered')
    expect(answer.message.toLowerCase()).toContain('open')
  })

  it('reads the whole list back when asked for the calendar', () => {
    const answer = answerClosure({ ask: 'holiday_calendar' })

    expect(answer.kind).toBe('answered')
    // Every published date appears: a partial list read back as the whole one is a wrong answer.
    for (const holiday of centerData.closures.published_holidays_2026_2027) {
      expect(answer.message).toContain(holiday.name)
    }
  })

  it('holds no second list of closures anywhere', () => {
    // known_gaps is gone. If it returns, a date can be closed in one place and open in
    // another, and the two answers disagree.
    expect('known_gaps' in centerData.closures).toBe(false)
  })
})
