import { describe, expect, it } from 'vitest'
import { answerClosure } from '../src/rules/schedule.js'

// "Not on the list" only means open INSIDE the range the list covers.
// FLOW: date -> published holiday? -> weekend? -> inside the published range? -> open : ask a person
// 1. the list is two school years; a date beyond it was answered "open" with full confidence
// 2. a parent asked about January 1 2032 and was told to come in -- on New Year's Day
// 3. silence about 2032 is not evidence about 2032

describe('a date outside the published calendar is not an answer', () => {
  it('does not claim to know a day six years out', () => {
    const answer = answerClosure({ date: '2032-01-01', ask: 'specific_day' })

    expect(answer.kind).not.toBe('answered')
    expect(answer.message).not.toMatch(/we are open that day/i)
  })

  it('still answers a normal day inside the calendar', () => {
    const answer = answerClosure({ date: '2026-10-13', ask: 'specific_day' })

    expect(answer.kind).toBe('answered')
    expect(answer.message).toMatch(/open/i)
  })

  it('still closes on a published holiday', () => {
    const answer = answerClosure({ date: '2026-09-07', ask: 'specific_day' })

    expect(answer.kind).toBe('answered')
    expect(answer.message).toMatch(/closed/i)
  })
})
