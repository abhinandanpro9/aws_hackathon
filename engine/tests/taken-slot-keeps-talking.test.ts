import { describe, expect, it } from 'vitest'
import { bookTourTool } from '../src/tools/book-tour.js'

// A taken slot is a question, not a dead end.
// FLOW: slot taken -> is anything else open that day? -> offer it and keep the turn
// 1. needs_human ends the conversation and hands the parent a phone number
// 2. doing that while 13:30 sits free makes the desk useless at the one thing it can do
// 3. only a day with NOTHING open is genuinely a person's problem

const NO_BOOKINGS: readonly { date: string; time: string }[] = []
const TAKEN = [{ date: '2026-09-03', time: '09:30' }]

describe('a taken slot offers what is free instead of ending the turn', () => {
  it('keeps talking when another slot that day is open', () => {
    const result = bookTourTool.execute({ date: '2026-09-03', time: '09:30' }, { bookings: TAKEN })

    expect(result.answer).toContain('13:30')
    expect(result.outcome).not.toBe('needs_human')
  })

  it('still books a free slot', () => {
    const result = bookTourTool.execute({ date: '2026-09-03', time: '09:30' }, { bookings: NO_BOOKINGS })

    expect(result.outcome).toBe('answered')
  })
})
