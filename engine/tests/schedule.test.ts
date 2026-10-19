import { describe, expect, it } from 'vitest'
import { answerClosure, answerHours, answerTours } from '../src/rules/schedule.js'

// The four intents the prototype handles properly: hours, closures, tours, daily.
// FLOW: question -> resolve what we actually know -> answer, ask, or hand off
// 1. hours depend on WHICH child, so an unresolved question asks rather than averaging
// 2. closures run an ordered ladder: published holiday -> known gap -> weather -> open
// 3. nothing here books anything; an action request names a person and a number
// WHY: a single averaged closing time is wrong for most parents at this center

describe('answerHours - the answer depends on which child', () => {
  it('asks which program when none is given', () => {
    const result = answerHours({})
    expect(result.kind).toBe('needs_program')
    expect(result.message.toLowerCase()).toContain('which')
  })

  it('names the programs when it asks', () => {
    expect(answerHours({}).message).toContain('Pre-K')
  })

  it('answers exactly for the infant room', () => {
    const result = answerHours({ programId: 'infant' })
    expect(result.kind).toBe('answered')
    expect(result.message).toContain('7:30')
    expect(result.message).toContain('5:30')
  })

  it('answers exactly for pre-k, which finishes earlier', () => {
    const result = answerHours({ programId: 'prek' })
    expect(result.message).toContain('2:30')
  })

  it('does not give the pre-k parent the center envelope', () => {
    expect(answerHours({ programId: 'prek' }).message).not.toContain('5:30 pm')
  })

  it('mentions extended care when a program has it', () => {
    expect(answerHours({ programId: 'prek' }).message.toLowerCase()).toContain('extended care')
  })

  it('falls back to asking for an unknown program', () => {
    expect(answerHours({ programId: 'nursery' }).kind).toBe('needs_program')
  })

  it('says the center is closed at weekends', () => {
    const result = answerHours({ programId: 'infant', date: '2026-08-29' })
    expect(result.message.toLowerCase()).toContain('closed')
  })
})

describe('answerClosure - an ordered ladder, first match wins', () => {
  it('answers a published holiday', () => {
    const result = answerClosure({ date: '2026-12-25' })
    expect(result.kind).toBe('answered')
    expect(result.message).toContain('Christmas Day')
    expect(result.message.toLowerCase()).toContain('closed')
  })

  it('answers an ordinary weekday as open', () => {
    const result = answerClosure({ date: '2026-09-15' })
    expect(result.kind).toBe('answered')
    expect(result.message.toLowerCase()).toContain('open')
  })

  it('reads the published closure list back when asked for the calendar', () => {
    // The published dates ARE the calendar. There is no second list held elsewhere, so this
    // is an answer rather than a hand-off.
    const result = answerClosure({ ask: 'holiday_calendar' })
    expect(result.kind).toBe('answered')
    expect(result.message).toContain('Labor Day')
    expect(result.citation).not.toBeNull()
  })

  it('hands snow closures to the school district', () => {
    const result = answerClosure({ ask: 'weather' })
    expect(result.kind).toBe('owned_elsewhere')
    expect(result.message).toContain('Fairmont')
  })

  it('prefers a published holiday over a calendar gap when a date is given', () => {
    expect(answerClosure({ date: '2026-11-26', ask: 'holiday_calendar' }).kind).toBe('answered')
  })

  it('says the centre is closed at weekends', () => {
    expect(answerClosure({ date: '2026-08-29' }).message.toLowerCase()).toContain('closed')
  })
})

describe('answerTours - reports the schedule, never books', () => {
  it('gives the days and times', () => {
    const result = answerTours({})
    expect(result.kind).toBe('answered')
    expect(result.message).toContain('Tuesday')
    expect(result.message).toContain('9:30')
  })

  it('confirms a day tours run', () => {
    const result = answerTours({ date: '2026-09-01' })
    expect(result.message.toLowerCase()).toContain('tuesday')
  })

  it('says when the next tour day is if asked about a day without tours', () => {
    const result = answerTours({ date: '2026-09-02' })
    expect(result.message.toLowerCase()).toContain('thursday')
  })

  it('answers a booking ask with the schedule; book_tour does the booking', () => {
    const result = answerTours({ wantsToBook: true })
    expect(result.kind).toBe('answered')
  })

  it('never itself claims to have booked anything', () => {
    // The RULE reports times; only the book_tour tool may say "Booked".
    const answer = answerTours({ wantsToBook: true }).message.toLowerCase()
    expect(answer).not.toContain('booked')
    expect(answer).not.toContain('reserved')
  })

  it('still tells them the times when handing off', () => {
    expect(answerTours({ wantsToBook: true }).message).toContain('9:30')
  })
})

describe('a weather hand-off is one a parent can act on', () => {
  it('routes to a person with a number, not to an institution', () => {
    // The district owns the ANNOUNCEMENT; the parent still needs someone to call. The data
    // carries owner_id for exactly this, and the rule ignored it -- the contact card showed
    // "Fairmont School District" with no number at all.
    const result = answerClosure({ ask: 'weather' })

    expect(result.routeTo).toContain('ext.')
  })

  it('still names the district as the authority in the message', () => {
    const result = answerClosure({ ask: 'weather' })

    expect(result.message).toContain('Fairmont School District')
  })
})
