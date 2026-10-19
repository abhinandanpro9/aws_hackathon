// Attendance rule types. One source of truth for the illness ladder's contract.

export const ATTENDANCE_DECISIONS = ['may_attend', 'stay_home', 'ask_a_human'] as const
export type AttendanceDecision = (typeof ATTENDANCE_DECISIONS)[number]

export const CRITERION_IDS = [
  'fever',
  'vomiting',
  'diarrhea',
  'antibiotics',
  'pink_eye',
  'rash',
  'contagious',
  'persistent_cough',
  'not_participating',
] as const
export type CriterionId = (typeof CRITERION_IDS)[number]

/** What the extraction step produces. Every field optional: parents report what they report. */
export interface SymptomReport {
  readonly temperatureF?: number
  readonly hoursSinceFeverBroke?: number
  readonly hoursSinceVomiting?: number
  readonly hoursSinceDiarrhea?: number
  readonly hoursOnAntibiotics?: number
  readonly suspectedPinkEye?: boolean
  readonly undiagnosedRash?: boolean
  readonly contagiousSymptoms?: boolean
  readonly persistentCough?: boolean
  readonly cannotParticipate?: boolean
  /** A temperature was mentioned but could not be read as a number. */
  readonly temperatureUnknown?: boolean
  /** Symptom text the extractor could not map to a criterion. */
  readonly unparsedSymptomText?: string
}

export interface AttendanceVerdict {
  readonly decision: AttendanceDecision
  readonly matchedCriterion: CriterionId | null
  readonly reason: string
  readonly requiresDoctorNote: boolean
  readonly citation: string
}

/** One rung of the ladder. Ordered; first match wins. */
export interface Exclusion {
  readonly id: CriterionId
  readonly requiresDoctorNote: boolean
  readonly applies: (report: SymptomReport) => boolean
  readonly reason: string
}

/**
 * How a criterion is tested. The operator owns the numbers and the wording;
 * engineering owns these three comparisons.
 */
export const PREDICATE_KINDS = [
  'temperature_at_or_above',
  'hours_since_within',
  'hours_since_below',
  'flag_is_true',
] as const
export type PredicateKind = (typeof PREDICATE_KINDS)[number]

/** Numeric fields a criterion may read from a symptom report. */
export type NumericSymptomField =
  | 'temperatureF'
  | 'hoursSinceFeverBroke'
  | 'hoursSinceVomiting'
  | 'hoursSinceDiarrhea'
  | 'hoursOnAntibiotics'

/** Boolean fields a criterion may read from a symptom report. */
export type BooleanSymptomField =
  | 'suspectedPinkEye'
  | 'undiagnosedRash'
  | 'contagiousSymptoms'
  | 'persistentCough'
  | 'cannotParticipate'

/**
 * A criterion exactly as it appears in the center's data file.
 * Editable by an operator: threshold, hours, and the wording a parent reads.
 */
export interface CriterionData {
  readonly id: string
  readonly kind: PredicateKind
  readonly reason: string
  readonly requires_note?: boolean
  readonly threshold_f?: number
  readonly clear_after_hours?: number
  /** Numeric field this criterion reads. */
  readonly field?: string
  /** A second numeric field, used by fever to also catch a recently-broken fever. */
  readonly also_field?: string
  /** Boolean field this criterion reads. */
  readonly flag?: string
}
