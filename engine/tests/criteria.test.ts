import { describe, expect, it } from 'vitest'
import centerData from '../data/center.json' with { type: 'json' }
import { buildExclusions } from '../src/rules/criteria.js'
import type { CriterionData } from '../src/types/attendance.js'

// Criteria are data, not code. An operator edits a number or a sentence; nobody deploys.
// FLOW: center.json exclusion_criteria -> buildExclusions -> ordered ladder -> evaluateAttendance
// 1. the operator owns thresholds and wording; engineering owns the three comparisons
// 2. order in the data file is the order of the ladder -- first match wins
// 3. an unknown kind is dropped with no silent pass; a rule we cannot evaluate must not allow attendance

describe('buildExclusions - reads the center data', () => {
  it('builds one exclusion per criterion in the file', () => {
    const built = buildExclusions(centerData.illness.exclusion_criteria as readonly CriterionData[])
    expect(built).toHaveLength(centerData.illness.exclusion_criteria.length)
  })

  it('keeps the order the operator wrote them in', () => {
    const built = buildExclusions(centerData.illness.exclusion_criteria as readonly CriterionData[])
    expect(built[0]?.id).toBe('fever')
  })

  it('uses the reason text from the data, not from code', () => {
    const built = buildExclusions(centerData.illness.exclusion_criteria as readonly CriterionData[])
    expect(built[0]?.reason).toBe(centerData.illness.exclusion_criteria[0]?.reason)
  })

  it('carries the doctor-note requirement from the data', () => {
    const built = buildExclusions(centerData.illness.exclusion_criteria as readonly CriterionData[])
    expect(built.find((e) => e.id === 'rash')?.requiresDoctorNote).toBe(true)
    expect(built.find((e) => e.id === 'fever')?.requiresDoctorNote).toBe(false)
  })
})

describe('buildExclusions - temperature_at_or_above', () => {
  const criterion: CriterionData = {
    id: 'fever',
    kind: 'temperature_at_or_above',
    field: 'temperatureF',
    also_field: 'hoursSinceFeverBroke',
    threshold_f: 100.4,
    clear_after_hours: 24,
    reason: 'stay home',
  }

  it('matches at the threshold', () => {
    expect(buildExclusions([criterion])[0]?.applies({ temperatureF: 100.4 })).toBe(true)
  })

  it('does not match below the threshold', () => {
    expect(buildExclusions([criterion])[0]?.applies({ temperatureF: 99 })).toBe(false)
  })

  it('also matches a fever that broke within the clear window', () => {
    expect(buildExclusions([criterion])[0]?.applies({ hoursSinceFeverBroke: 8 })).toBe(true)
  })

  it('does not match once the clear window has passed', () => {
    expect(buildExclusions([criterion])[0]?.applies({ hoursSinceFeverBroke: 25 })).toBe(false)
  })
})

describe('buildExclusions - the operator can change a threshold', () => {
  it('honours a lowered fever threshold without any code change', () => {
    const stricter: CriterionData = {
      id: 'fever',
      kind: 'temperature_at_or_above',
      field: 'temperatureF',
      threshold_f: 99.5,
      reason: 'stay home',
    }
    expect(buildExclusions([stricter])[0]?.applies({ temperatureF: 99.6 })).toBe(true)
  })

  it('honours a longer clear window without any code change', () => {
    const stricter: CriterionData = {
      id: 'vomiting',
      kind: 'hours_since_within',
      field: 'hoursSinceVomiting',
      clear_after_hours: 48,
      reason: 'stay home',
    }
    expect(buildExclusions([stricter])[0]?.applies({ hoursSinceVomiting: 40 })).toBe(true)
  })
})

describe('buildExclusions - hours kinds', () => {
  it('hours_since_within matches inside the window', () => {
    const c: CriterionData = { id: 'vomiting', kind: 'hours_since_within', field: 'hoursSinceVomiting', clear_after_hours: 24, reason: 'r' }
    expect(buildExclusions([c])[0]?.applies({ hoursSinceVomiting: 24 })).toBe(true)
    expect(buildExclusions([c])[0]?.applies({ hoursSinceVomiting: 25 })).toBe(false)
  })

  it('hours_since_below matches strictly under the window', () => {
    const c: CriterionData = { id: 'antibiotics', kind: 'hours_since_below', field: 'hoursOnAntibiotics', clear_after_hours: 24, reason: 'r' }
    expect(buildExclusions([c])[0]?.applies({ hoursOnAntibiotics: 23 })).toBe(true)
    expect(buildExclusions([c])[0]?.applies({ hoursOnAntibiotics: 24 })).toBe(false)
  })

  it('does not match when the field is absent', () => {
    const c: CriterionData = { id: 'vomiting', kind: 'hours_since_within', field: 'hoursSinceVomiting', clear_after_hours: 24, reason: 'r' }
    expect(buildExclusions([c])[0]?.applies({})).toBe(false)
  })
})

describe('buildExclusions - flag_is_true', () => {
  it('matches when the flag is true', () => {
    const c: CriterionData = { id: 'rash', kind: 'flag_is_true', flag: 'undiagnosedRash', reason: 'r' }
    expect(buildExclusions([c])[0]?.applies({ undiagnosedRash: true })).toBe(true)
  })

  it('does not match when the flag is false or missing', () => {
    const c: CriterionData = { id: 'rash', kind: 'flag_is_true', flag: 'undiagnosedRash', reason: 'r' }
    expect(buildExclusions([c])[0]?.applies({ undiagnosedRash: false })).toBe(false)
    expect(buildExclusions([c])[0]?.applies({})).toBe(false)
  })
})

describe('buildExclusions - bad data never silently allows attendance', () => {
  it('drops a criterion with an unknown kind', () => {
    const bad = { id: 'mystery', kind: 'vibes_based', reason: 'r' } as unknown as CriterionData
    expect(buildExclusions([bad])).toHaveLength(0)
  })

  it('drops a criterion missing the field it needs', () => {
    const bad: CriterionData = { id: 'vomiting', kind: 'hours_since_within', clear_after_hours: 24, reason: 'r' }
    expect(buildExclusions([bad])).toHaveLength(0)
  })

  it('drops a temperature criterion with no threshold', () => {
    const bad: CriterionData = { id: 'fever', kind: 'temperature_at_or_above', field: 'temperatureF', reason: 'r' }
    expect(buildExclusions([bad])).toHaveLength(0)
  })

  it('keeps the good criteria when one is malformed', () => {
    const bad = { id: 'mystery', kind: 'nonsense', reason: 'r' } as unknown as CriterionData
    const good: CriterionData = { id: 'rash', kind: 'flag_is_true', flag: 'undiagnosedRash', reason: 'r' }
    expect(buildExclusions([bad, good])).toHaveLength(1)
  })
})
