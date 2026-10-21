// Turns the center's editable criteria data into the ladder the rule walks.
// FLOW: center.json exclusion_criteria -> buildExclusions -> ordered Exclusion[] -> evaluateAttendance
// 1. the operator owns thresholds and wording; this file owns the three comparisons
// 2. order in the data file IS the order of the ladder, so first match wins
// 3. a criterion we cannot evaluate is DROPPED, never turned into a permissive pass
// WHY: a center changing 100.4 to 100.0 must not need a deploy; inventing a new operator must

import type {
  BooleanSymptomField,
  CriterionData,
  CriterionId,
  Exclusion,
  NumericSymptomField,
  SymptomReport,
} from '../types/attendance.js'

// ─── Field readers ───

function readNumeric(report: SymptomReport, field: string): number | undefined {
  return report[field as NumericSymptomField]
}

function readBoolean(report: SymptomReport, field: string): boolean | undefined {
  return report[field as BooleanSymptomField]
}

// ─── Predicate builders, one per kind ───

// Pattern: Strategy. Each kind is a function that turns data into a predicate.
type PredicateBuilder = (c: CriterionData) => ((report: SymptomReport) => boolean) | null

const BUILDERS: Readonly<Record<string, PredicateBuilder>> = {
  temperature_at_or_above: (c) => {
    if (c.field === undefined || c.threshold_f === undefined) return null
    const { field, threshold_f: threshold, also_field: alsoField, clear_after_hours: clearAfter } = c
    return (report) => {
      const temperature = readNumeric(report, field)
      if (temperature !== undefined && temperature >= threshold) return true
      if (alsoField === undefined || clearAfter === undefined) return false
      const sinceCleared = readNumeric(report, alsoField)
      return sinceCleared !== undefined && sinceCleared <= clearAfter
    }
  },

  hours_since_within: (c) => {
    if (c.field === undefined || c.clear_after_hours === undefined) return null
    const { field, clear_after_hours: window } = c
    return (report) => {
      const hours = readNumeric(report, field)
      return hours !== undefined && hours <= window
    }
  },

  hours_since_below: (c) => {
    if (c.field === undefined || c.clear_after_hours === undefined) return null
    const { field, clear_after_hours: window } = c
    return (report) => {
      const hours = readNumeric(report, field)
      return hours !== undefined && hours < window
    }
  },

  flag_is_true: (c) => {
    if (c.flag === undefined) return null
    const { flag } = c
    return (report) => readBoolean(report, flag) === true
  },
}

/**
 * Build the ordered ladder from the center's data.
 * A criterion with an unknown kind or missing fields is dropped: an unevaluable rule
 * must never become a silent "may attend".
 */
export function buildExclusions(criteria: readonly CriterionData[]): readonly Exclusion[] {
  const built: Exclusion[] = []

  for (const criterion of criteria) {
    const builder = BUILDERS[criterion.kind]
    if (builder === undefined) continue

    const applies = builder(criterion)
    if (applies === null) continue

    built.push({
      id: criterion.id as CriterionId,
      requiresDoctorNote: criterion.requires_note === true,
      applies,
      reason: criterion.reason,
    })
  }

  return built
}
