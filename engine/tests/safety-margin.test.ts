import { describe, expect, it } from 'vitest'
import { checkAttendanceTool } from '../src/tools/check-attendance.js'

// The prototype answers exclusions, and defers clearances to a person.
// FLOW: rule decides -> may_attend -> MAY_CLEAR_CHILD_TO_ATTEND is false -> Health Lead
// 1. the two verdicts are not symmetric, so they do not get the same treatment
// 2. "stay home" still answers with full confidence -- that is the safe direction
// 3. the rule's actual verdict is still reported, so an operator sees what it would have said
// WHY: with zero real users we have not earned the right to clear a sick child

describe('exclusions state the verdict and route it', () => {
  it('tells a parent with a feverish child to stay home', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.4 })
    expect(result.outcome).toBe('needs_human')
    expect(result.detail['decision']).toBe('stay_home')
  })

  it('answers on vomiting inside the window', () => {
    expect(checkAttendanceTool.execute({ hoursSinceVomiting: 3 }).outcome).toBe('needs_human')
  })

  it('answers on an undiagnosed rash', () => {
    expect(checkAttendanceTool.execute({ undiagnosedRash: true }).outcome).toBe('needs_human')
  })
})

describe('clearances are deferred to a person', () => {
  // A normal temperature is a REAL symptom report that matches no criterion, which is the
  // case this switch exists for. An empty report is a different thing: nothing was described,
  // so the tool asks instead of ruling. See the no_symptoms_given branch.
  const NOTHING_WRONG = { temperatureF: 98.6 }

  it('does not tell a parent their child may attend', () => {
    const result = checkAttendanceTool.execute(NOTHING_WRONG)
    expect(result.outcome).toBe('needs_human')
  })

  it('routes a clearance to the health lead', () => {
    expect(checkAttendanceTool.execute(NOTHING_WRONG).routeTo).toContain('Dana')
  })

  it('defers even when the symptom is comfortably past its window', () => {
    const result = checkAttendanceTool.execute({ hoursSinceFeverBroke: 72 })
    expect(result.outcome).toBe('needs_human')
  })

  it('still reports what the rule decided, for the operator', () => {
    const result = checkAttendanceTool.execute(NOTHING_WRONG)
    expect(result.detail['ruleVerdict']).toBe('may_attend')
    expect(result.detail['deferred']).toBe(true)
  })

  it('does not claim the child is unwell when deferring', () => {
    const answer = checkAttendanceTool.execute(NOTHING_WRONG).answer.toLowerCase()
    expect(answer).not.toContain('stay home')
  })
})

describe('the ungradable case is unchanged', () => {
  it('still routes an unmappable symptom to a person', () => {
    const result = checkAttendanceTool.execute({ unparsedSymptomText: 'holding her ear' })
    expect(result.outcome).toBe('needs_human')
    expect(result.detail['decision']).toBe('ask_a_human')
  })
})
