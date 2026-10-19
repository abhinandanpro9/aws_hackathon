import { describe, expect, it } from 'vitest'
import { checkAttendanceTool } from '../src/tools/check-attendance.js'

// A stay-home verdict always reaches the Health Lead. It is never the end of the conversation.
// FLOW: criterion matches -> stay_home stated plainly -> routed to Dana -> the loop hands off
// 1. real failure, 2026-08-25. "her fever broke yesterday morning, can she come in tomorrow?"
//    -> "Yes, she can come in tomorrow". Pushed back on, it doubled down: "she will have
//    passed the required 24 hours fever-free by tomorrow morning" -- the model doing health
//    arithmetic no tool performed, cited to the illness policy.
// 2. removing the return policy from the answer was not enough: the criterion text carries
//    the 24-hour number, which is the whole reason the verdict makes sense. The model can do
//    the arithmetic from that alone.
// 3. so the loop ends the turn instead. A routed result stops the model talking past it, and
//    a return is confirmed by a person, which is what MAY_CLEAR_CHILD_TO_ATTEND meant all along
// WHY: the desk may say a child stays home. It may never say one may come in, on any day.

describe('a stay-home verdict routes to a person', () => {
  it('hands off rather than closing the conversation', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })

    expect(result.outcome).toBe('needs_human')
    expect(result.routeTo).toContain('Dana')
  })

  it('still states the verdict plainly, not softened into a maybe', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })

    expect(result.answer.toLowerCase()).toContain('staying home')
  })

  it('names who confirms a return, instead of stating the condition', () => {
    // The condition invites arithmetic about a future day. A name does not.
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })

    expect(result.answer).toContain('Dana')
    expect(result.answer.toLowerCase()).not.toContain('may return once')
  })

  it('carries the verdict for the operator even though it routed', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })

    expect(result.detail['ruleVerdict']).toBe('stay_home')
  })

  it('still defers a may_attend verdict, as before', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 98.6 })

    expect(result.outcome).toBe('needs_human')
    expect(result.detail['deferred']).toBe(true)
  })

  it('still asks when no symptom was given', () => {
    const result = checkAttendanceTool.execute({})

    expect(result.outcome).toBe('needs_detail')
  })
})
