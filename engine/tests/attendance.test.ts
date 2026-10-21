import { describe, expect, it } from 'vitest'
import { evaluateAttendance } from '../src/rules/attendance.js'
import type { SymptomReport } from '../src/types/attendance.js'

// The deterministic ladder that decides whether a child may attend.
// FLOW: parent question -> extracted symptoms -> evaluateAttendance() -> verdict -> phrased reply
// 1. the model may extract and phrase, it may never decide
// 2. first matching criterion wins, so order is part of the contract
// 3. an unclear report is NOT a yes -- it routes to a human
// WHY: a wrong "yes" on a fever is a licensing and health incident, not a UX blemish

const clear: SymptomReport = {}

describe('evaluateAttendance - fever', () => {
  it('excludes a child at or above 100.4F', () => {
    const r = evaluateAttendance({ temperatureF: 100.4 })
    expect(r.decision).toBe('stay_home')
    expect(r.matchedCriterion).toBe('fever')
  })

  it('excludes a child above the threshold', () => {
    expect(evaluateAttendance({ temperatureF: 101.2 }).decision).toBe('stay_home')
  })

  it('excludes when a fever occurred within the last 24 hours, even if fine now', () => {
    const r = evaluateAttendance({ temperatureF: 98.6, hoursSinceFeverBroke: 8 })
    expect(r.decision).toBe('stay_home')
    expect(r.matchedCriterion).toBe('fever')
  })

  it('allows attendance once 24 fever-free hours have passed', () => {
    expect(evaluateAttendance({ temperatureF: 98.6, hoursSinceFeverBroke: 25 }).decision).toBe('may_attend')
  })

  it('treats exactly 24 hours as still excluded', () => {
    expect(evaluateAttendance({ hoursSinceFeverBroke: 24 }).decision).toBe('stay_home')
  })
})

describe('evaluateAttendance - other exclusion criteria', () => {
  it('excludes on vomiting within 24 hours', () => {
    const r = evaluateAttendance({ hoursSinceVomiting: 3 })
    expect(r.decision).toBe('stay_home')
    expect(r.matchedCriterion).toBe('vomiting')
  })

  it('excludes on diarrhea within 24 hours', () => {
    expect(evaluateAttendance({ hoursSinceDiarrhea: 12 }).matchedCriterion).toBe('diarrhea')
  })

  it('excludes on under 24 hours of antibiotics', () => {
    expect(evaluateAttendance({ hoursOnAntibiotics: 6 }).matchedCriterion).toBe('antibiotics')
  })

  it('allows attendance after 24 hours of antibiotics', () => {
    expect(evaluateAttendance({ hoursOnAntibiotics: 30 }).decision).toBe('may_attend')
  })

  it('excludes on suspected pink eye and requires a note', () => {
    const r = evaluateAttendance({ suspectedPinkEye: true })
    expect(r.decision).toBe('stay_home')
    expect(r.requiresDoctorNote).toBe(true)
  })

  it('excludes on an undiagnosed rash and requires a note', () => {
    const r = evaluateAttendance({ undiagnosedRash: true })
    expect(r.decision).toBe('stay_home')
    expect(r.requiresDoctorNote).toBe(true)
  })

  it('excludes on contagious illness symptoms', () => {
    expect(evaluateAttendance({ contagiousSymptoms: true }).matchedCriterion).toBe('contagious')
  })

  it('excludes when the child cannot take part in the day', () => {
    expect(evaluateAttendance({ cannotParticipate: true }).matchedCriterion).toBe('not_participating')
  })
})

describe('evaluateAttendance - the clear case', () => {
  it('allows attendance when nothing is reported', () => {
    const r = evaluateAttendance(clear)
    expect(r.decision).toBe('may_attend')
    expect(r.matchedCriterion).toBeNull()
    expect(r.requiresDoctorNote).toBe(false)
  })

  it('allows attendance on a normal temperature alone', () => {
    expect(evaluateAttendance({ temperatureF: 98.2 }).decision).toBe('may_attend')
  })
})

describe('evaluateAttendance - precedence', () => {
  it('reports fever first when several criteria match', () => {
    const r = evaluateAttendance({ temperatureF: 101, hoursSinceVomiting: 2, undiagnosedRash: true })
    expect(r.matchedCriterion).toBe('fever')
  })

  it('still requires a note when a later criterion demands one', () => {
    const r = evaluateAttendance({ temperatureF: 101, undiagnosedRash: true })
    expect(r.requiresDoctorNote).toBe(true)
  })
})

describe('evaluateAttendance - uncertainty is not a yes', () => {
  it('asks a human when the report mentions symptoms it cannot grade', () => {
    const r = evaluateAttendance({ unparsedSymptomText: 'she seems really off and keeps holding her ear' })
    expect(r.decision).toBe('ask_a_human')
    expect(r.matchedCriterion).toBeNull()
  })

  it('never returns may_attend when a temperature was mentioned but not readable', () => {
    const r = evaluateAttendance({ temperatureUnknown: true })
    expect(r.decision).toBe('ask_a_human')
  })

  it('prefers a definite exclusion over asking a human', () => {
    const r = evaluateAttendance({ temperatureF: 102, unparsedSymptomText: 'also very clingy' })
    expect(r.decision).toBe('stay_home')
  })
})

describe('evaluateAttendance - every verdict carries a citation', () => {
  it('cites the policy for an exclusion', () => {
    const r = evaluateAttendance({ temperatureF: 101 })
    expect(r.citation).toContain('illness')
  })

  it('cites the policy for a clear verdict too', () => {
    expect(evaluateAttendance(clear).citation).toContain('illness')
  })
})
