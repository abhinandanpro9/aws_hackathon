import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// A date the tool cannot read is not a date, and must never reach the ladder.
// FLOW: date arg -> is it a real YYYY-MM-DD? -> ladder, or ask again
// 1. the ladder asks "is it published" and "is it a weekend". Both answer NO for nonsense,
//    so an unreadable date fell through to "nothing says otherwise -> we are open"
// 2. that is a fabricated closure answer built from a string the model invented, and the
//    parent cannot tell it apart from a real one
// 3. the model is TOLD to pass YYYY-MM-DD. This is the check that it did, rather than trust

const NOT_DATES = ['tomorrow', 'next monday', '2026-13-45', '2026-02-30', '11/11/2026', 'soon']

describe('an unreadable date never becomes an answer', () => {
  for (const date of NOT_DATES) {
    it(`refuses to answer on "${date}"`, () => {
      const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date })

      expect(result.outcome).not.toBe('answered')
      expect(result.answer.toLowerCase()).not.toContain('we are open')
    })
  }

  it('never renders a weekday it could not work out', () => {
    // "We are open that day, that day" -- weekdayOf fell back and the sentence shipped anyway.
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date: 'tomorrow' })

    expect(result.answer).not.toContain('that day, that day')
  })

  it('still answers a real date', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date: '2026-08-26' })

    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('open')
  })

  it('still recognises a real published holiday', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date: '2026-09-07' })

    expect(result.answer).toContain('Labor Day')
  })
})
