import { describe, expect, it } from 'vitest'
import { escalateTool } from '../src/tools/escalate.js'
import { answerClosure, answerHours, answerTours } from '../src/rules/schedule.js'

// Written replies are hardcoded, so the prompt's formatting rules never reach them.
// FLOW: tool or rule -> a fixed string -> straight to the parent's screen
// 1. the model rewrites nothing here, so whatever shape these have is the shape a parent sees
// 2. an answer and a phone number are two different things and belong on two lines: a number
//    buried mid-paragraph is the part a parent has to hunt for
// 3. the UI renders markdown, so **bold** on the thing to act on works here too

/** A reply carrying a phone number must put it on its own line, not mid-sentence. */
function contactIsOnItsOwnLine(message: string): boolean {
  const line = message.split('\n').find((l) => l.includes('ext.'))
  if (line === undefined) return false
  // The contact line carries the contact, not the whole answer as well.
  return line.trim().length < 120
}

describe('written replies are shaped for a phone screen', () => {
  it('splits the escalation from the number to call', () => {
    const result = escalateTool.execute({ topic: 'custody' })

    expect(result.answer).toContain('\n')
    expect(contactIsOnItsOwnLine(result.answer)).toBe(true)
  })

  it('lists the closure dates rather than running them into a sentence', () => {
    // Eight dates in one paragraph is the shape a parent cannot scan.
    const answer = answerClosure({ ask: 'holiday_calendar' })

    expect(answer.message).toContain('\n- ')
  })

  it('asks one short question when the day is vague', () => {
    // A vague date is a clarifying question, not a hand-off: there is no second calendar to
    // point a parent at, so it asks rather than routing.
    const answer = answerClosure({ ask: 'specific_day' })

    expect(answer.routeTo).toBeNull()
    expect(answer.message.length).toBeLessThan(120)
  })

  it('splits the tour times onto their own line', () => {
    // The gate is on, so a booking ask answers; the times still lead on their own line.
    const answer = answerTours({ wantsToBook: true })

    expect(answer.message).toContain('Tours run')
  })

  it('keeps a short answer short, with no padding', () => {
    // A plain answer needs no second line and must not grow one.
    const answer = answerHours({ programId: 'toddler' })

    expect(answer.message.length).toBeLessThan(200)
  })
})
