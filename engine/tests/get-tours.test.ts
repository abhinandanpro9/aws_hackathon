import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// Tour times, and the honest limit that we cannot book one.
// FLOW: model asks -> tour rule reads center.json -> times, or a hand-off to book
// 1. the front desk reads and reports; it never reserves a slot (FRONT_DESK_CAN_TAKE_ACTIONS)
// 2. "when are tours" is answered; "book me a tour" names the person who can
// 3. that split is the whole read-only design, so both directions are tested

describe('get_tours declaration', () => {
  it('lets the model say the parent wants to book, not just ask', () => {
    expect(Object.keys(getCenterFactsTool.declaration.parameters.properties)).toContain('wantsToBook')
  })
})

describe('get_tours reports times', () => {
  it('answers when the tours run', () => {
    const result = getCenterFactsTool.execute({ topic: 'tours' })
    expect(result.outcome).toBe('answered')
    expect(result.answer).toContain('Tuesday')
    expect(result.sourceId).toBe('center:tours')
  })
})

describe('get_tours reports; book_tour is where booking lives', () => {
  it('answers a booking-flavoured ask with the schedule, gate on', () => {
    const result = getCenterFactsTool.execute({ topic: 'tours', wantsToBook: true })
    expect(result.outcome).toBe('answered')
  })
})
