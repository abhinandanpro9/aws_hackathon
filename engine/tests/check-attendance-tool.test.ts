import { describe, expect, it } from 'vitest'
import centerData from '../data/center.json' with { type: 'json' }
import { checkAttendanceTool } from '../src/tools/check-attendance.js'

// The sick-child tool. The rule decides; the model only fills the form.
// FLOW: center.json criteria -> generated parameters -> model fills -> rule decides -> result
// 1. the fields the model can fill are GENERATED from the criteria, never hand-typed
// 2. an operator adding a criterion makes its field askable with no code change
// 3. a clearance is never given automatically, because the two verdicts are not symmetric

describe('check_attendance parameters come from the center data', () => {
  it('exposes a field for every criterion an operator has written', () => {
    const properties = Object.keys(checkAttendanceTool.declaration.parameters.properties)

    for (const criterion of centerData.illness.exclusion_criteria) {
      const owned = criterion.field ?? criterion.flag
      expect(properties).toContain(owned)
    }
  })

  it('exposes the follow-up field a criterion names, such as when a fever broke', () => {
    const properties = Object.keys(checkAttendanceTool.declaration.parameters.properties)
    expect(properties).toContain('hoursSinceFeverBroke')
  })

  it('always offers somewhere to put a symptom the criteria do not cover', () => {
    const properties = Object.keys(checkAttendanceTool.declaration.parameters.properties)
    expect(properties).toContain('unparsedSymptomText')
  })

  it('types a threshold field as a number and a flag as a boolean', () => {
    const properties = checkAttendanceTool.declaration.parameters.properties
    expect(properties['temperatureF']?.type).toBe('number')
    expect(properties['suspectedPinkEye']?.type).toBe('boolean')
  })

  it('tells the model what each field means, in words it can act on', () => {
    const properties = checkAttendanceTool.declaration.parameters.properties
    for (const schema of Object.values(properties)) {
      expect(schema.description.length).toBeGreaterThan(10)
    }
  })
})

describe('check_attendance keeps the rule in charge', () => {
  it('says stay home for a fever above the threshold', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })
    // A stay-home verdict routes: the desk states it, and the Health Lead confirms any return.
    expect(result.outcome).toBe('needs_human')
    expect(result.answer.toLowerCase()).toContain('home')
  })

  it('records the criterion that decided it, for the operator', () => {
    // A routed answer carries no source id -- nothing was stated for a parent to check --
    // but the operator view still needs to know WHICH rung of the ladder decided.
    const result = checkAttendanceTool.execute({ temperatureF: 101.5 })
    expect(result.detail['matchedCriterion']).toBe('fever')
  })

  it('never clears a child on its own, even when nothing is wrong', () => {
    // A real symptom that matches no criterion. An EMPTY report is a different case: the
    // parent described nothing, so the tool asks rather than ruling on absent evidence.
    const result = checkAttendanceTool.execute({ temperatureF: 98.6 })
    expect(result.outcome).toBe('needs_human')
    expect(result.routeTo).not.toBeNull()
  })

  it('asks why, when the parent named no symptom at all', () => {
    // Why, not "what is wrong": "should my child come in today" might be about a holiday or
    // a trip, and presuming symptoms gives a parent a question that does not fit. The tool
    // states what is missing and leaves room for the answer to be "nothing is wrong".
    const result = checkAttendanceTool.execute({})
    expect(result.outcome).toBe('needs_detail')
    expect(result.answer.toLowerCase()).toContain('ask the parent why')
    expect(result.answer.toLowerCase()).not.toContain('what is wrong')
  })

  it('refuses a temperature no thermometer would report', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 900 })
    expect(result.outcome).toBe('invalid_arguments')
    expect(result.sourceId).toBeNull()
  })

  it('refuses a field sent as the wrong type rather than guessing at it', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 'hot' })
    expect(result.outcome).toBe('invalid_arguments')
  })
})
