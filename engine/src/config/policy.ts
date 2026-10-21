// Tunable policy values. One place to change a threshold, a wording, or a source label.
// FLOW: center.json (the center's own data) -> this file (derived + tunable) -> rules/ -> reply
// 1. numbers a center could plausibly change live here, never inline in a rule
// 2. anything read straight from center.json is re-exported here so rules import one module
// 3. thresholds are PLACEHOLDERS until real traffic tunes them (see docs/context.md, E3)

import centerData from '../../data/center.json' with { type: 'json' }

// ─── Illness ladder ───

/** Temperature at or above which a child stays home. */
export const FEVER_THRESHOLD_F = 100.4

/** Hours a symptom must be gone before a child returns. */
export const CLEAR_AFTER_HOURS = 24

// ─── Citations ───

export const CITATIONS = {
  illness: 'Sunflower Grove Family Handbook, illness policy',
  food: 'Sunflower Grove Family Handbook, meals and food policy',
  hours: 'Sunflower Grove Family Handbook, hours and programs',
  closures: 'Sunflower Grove Family Handbook, closure dates',
  tuition: 'Sunflower Grove Family Handbook, tuition and billing',
  enrollment: 'Sunflower Grove Family Handbook, enrollment',
  tours: 'Sunflower Grove Family Handbook, tours',
  daily: 'Sunflower Grove Family Handbook, the day',
  pickup: 'Sunflower Grove Family Handbook, arrival and pickup',
} as const

export type CitationKey = keyof typeof CITATIONS

// ─── Values sourced from the center's own data ───

export const RETURN_POLICY: string = centerData.illness.return_policy
export const ABSENCE_NOTICE: string = centerData.illness.notify
export const ESCALATION_TEMPLATE: string = centerData.escalation.message_to_parent
export const ESCALATION_HOURS_NOTE: string = centerData.escalation.hours_note
export const DEFAULT_ESCALATION_OWNER: string = centerData.escalation.default_owner

// ─── Prototype safety margin ───

/**
 * Whether the front desk may tell a parent their child MAY attend.
 *
 * False for now, deliberately. The two verdicts are not symmetric:
 * a wrong "stay home" costs a family a day; a wrong "may attend" puts a contagious
 * child in a room of infants. With zero real users we have not earned the second one.
 *
 * FLOW: rule decides -> may_attend -> this flag -> answer, or route to the Health Lead
 * 1. exclusions still answer with full confidence -- "stay home" is the safe direction
 * 2. every deferred clearance is logged with the verdict the rule reached, so an operator
 *    can see what the system WOULD have said and decide when to trust it
 * 3. flip to true once that log shows the rule agreeing with staff often enough
 *
 * Modelled on the refund agent that shipped read-only account lookups first and earned
 * the privileged action later.
 */
export const MAY_CLEAR_CHILD_TO_ATTEND = false

// ─── Read-only front desk ───

/**
 * The front desk reads and reports. It never books, reserves, cancels, or changes anything
 * on a family's behalf.
 *
 * FLOW: parent asks -> tools validate -> the ONE permitted action (tour booking) writes
 * 1. same principle as MAY_CLEAR_CHILD_TO_ATTEND: write access is earned, tool by tool
 * 2. switched on 2026-08-25: booking validates against real slots and a UNIQUE constraint
 *    is the final referee, so the worst failure is a refused insert, never a double booking
 * 3. health decisions stay read-only regardless: MAY_CLEAR_CHILD_TO_ATTEND is untouched
 */
export const FRONT_DESK_CAN_TAKE_ACTIONS = true
