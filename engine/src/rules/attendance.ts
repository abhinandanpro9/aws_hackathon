// The deterministic ladder that decides whether a child may attend today.
// FLOW: center.json criteria -> buildExclusions -> evaluateAttendance() -> verdict -> phrased reply
// 1. the model may extract and phrase, it may never decide -- this function owns the outcome
// 2. first matching criterion wins, so the ORDER IN center.json is part of the contract
// 3. an unclear report is never a yes; it degrades to ask_a_human
// WHY: a wrong "yes" on a fever is a licensing and health incident, not a UX blemish

import centerData from '../../data/center.json' with { type: 'json' }
import { CITATIONS } from '../config/policy.js'
import { buildExclusions } from './criteria.js'
import type { AttendanceVerdict, CriterionData, SymptomReport } from '../types/attendance.js'

const CITATION = CITATIONS.illness

// ─── The ladder, built from the center's editable data ───

const EXCLUSIONS = buildExclusions(
  centerData.illness.exclusion_criteria as readonly CriterionData[],
)

/** True when the report holds something we noticed but could not grade. */
function hasUngradableSignal(report: SymptomReport): boolean {
  const unparsed = report.unparsedSymptomText
  return report.temperatureUnknown === true || (unparsed !== undefined && unparsed.trim().length > 0)
}

/**
 * Decide whether a child may attend today.
 * First matching exclusion wins; a doctor's note is required if ANY matching criterion demands one.
 */
export function evaluateAttendance(report: SymptomReport): AttendanceVerdict {
  const matched = EXCLUSIONS.filter((e) => e.applies(report))
  const first = matched[0]

  if (first !== undefined) {
    return {
      decision: 'stay_home',
      matchedCriterion: first.id,
      // The verdict only. The return condition used to be appended here, which handed the
      // model a decision about today and a condition about a future day in one sentence --
      // asked "can she come in tomorrow", it did the arithmetic and answered yes. The tool
      // names the person who confirms a return instead.
      reason: first.reason,
      requiresDoctorNote: matched.some((e) => e.requiresDoctorNote),
      citation: CITATION,
    }
  }

  if (hasUngradableSignal(report)) {
    return {
      decision: 'ask_a_human',
      matchedCriterion: null,
      reason: 'Thank you for letting us know. This one needs a person to look at properly rather than a guess from me.',
      requiresDoctorNote: false,
      citation: CITATION,
    }
  }

  return {
    decision: 'may_attend',
    matchedCriterion: null,
    reason: 'Nothing here matches our stay-home list, so your child is welcome today.',
    requiresDoctorNote: false,
    citation: CITATION,
  }
}
