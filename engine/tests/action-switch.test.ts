import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRONT_DESK_CAN_TAKE_ACTIONS } from '../src/config/policy.js'
import { answerTours } from '../src/rules/schedule.js'

// The action boundary is a switch, and a switch nothing reads is decoration.
// FLOW: a parent asks to book -> FRONT_DESK_CAN_TAKE_ACTIONS -> book_tour writes, or a person
// 1. the refusal used to be hardcoded into the tour rule. It behaved correctly, but the flag
//    was never consulted, so flipping it to true would have changed nothing and the README
//    described a guardrail that did not exist
// 2. MAY_CLEAR_CHILD_TO_ATTEND is read at check-attendance.ts:160. This one must be too, or
//    the two switches are not the same kind of thing despite being presented as a pair

describe('the action boundary is enforced by its switch', () => {
  it('is on for tour booking, and only tour booking', () => {
    // Enabled 2026-08-25 for the frictionless demo. Health stays read-only regardless.
    expect(FRONT_DESK_CAN_TAKE_ACTIONS).toBe(true)
  })

  it('with the switch on, the tours rule stops refusing a booking ask', () => {
    const answer = answerTours({ wantsToBook: true })

    expect(answer.kind).toBe('answered')
  })

  it('still reports the times without being asked to book', () => {
    const answer = answerTours({})

    expect(answer.kind).toBe('answered')
    expect(answer.routeTo).toBeNull()
  })

  it('reads the switch rather than hardcoding the refusal', () => {
    // If the rule never mentions the flag, the flag is not what is stopping it.
    const source = readFileSync(new URL('../src/rules/schedule.ts', import.meta.url), 'utf8')

    expect(source).toContain('FRONT_DESK_CAN_TAKE_ACTIONS')
  })
})
