// The sick-child tool. The rule decides; the model only fills the form.
// FLOW: center.json criteria -> generated parameters -> model fills -> rule decides -> result
// 1. the fields are GENERATED from the criteria, so a new criterion is askable with no code edit
// 2. a criterion's model_hint is what teaches the model to fill it; rule/reason are for parents
// 3. a clearance is never given automatically -- a wrong "stay home" costs a day, a wrong
//    "may attend" puts a contagious child in a room of infants
// WHY: hand-typed fields meant an operator could add a rule the model could never trigger

import centerData from '../../data/center.json' with { type: 'json' }
import { MAY_CLEAR_CHILD_TO_ATTEND } from '../config/policy.js'
import { HOURS_BOUNDS, TEMPERATURE_BOUNDS, TOOL_DESCRIPTIONS } from '../config/tools.js'
import { evaluateAttendance } from '../rules/attendance.js'
import { invalidArguments, needsDetail, readBoolean, readNumber, readString } from './shared/args.js'
import { describeOwner, findStaff } from './shared/staff.js'
import type { SymptomReport } from '../types/attendance.js'
import type {
  RawToolArgs,
  Tool,
  ToolDeclaration,
  ToolPropertySchema,
  ToolResult,
} from '../types/tools.js'

/** One exclusion criterion, as an operator writes it in center.json. */
interface Criterion {
  readonly id: string
  readonly kind: string
  readonly field?: string
  readonly also_field?: string
  readonly flag?: string
  readonly rule: string
  readonly model_hint?: string
  readonly also_model_hint?: string
}

const CRITERIA: readonly Criterion[] = centerData.illness.exclusion_criteria

/** Who a deferred clearance goes to. The Health Lead owns the illness call. */
const HEALTH_LEAD_ID = centerData.staff[2]?.id ?? centerData.escalation.default_owner

/** Free text always has a home, so an unmatched symptom is reported rather than guessed at. */
const UNPARSED_FIELD = 'unparsedSymptomText'

interface NumericField {
  readonly name: string
  readonly bounds: typeof TEMPERATURE_BOUNDS | typeof HOURS_BOUNDS
}

/**
 * Every field the criteria can read, discovered from the data.
 * A temperature field is bounded by plausible temperatures; every other number is hours.
 */
function numericFields(): readonly NumericField[] {
  const fields: NumericField[] = []

  for (const criterion of CRITERIA) {
    const isTemperature = criterion.kind === 'temperature_at_or_above'
    if (criterion.field !== undefined) {
      fields.push({ name: criterion.field, bounds: isTemperature ? TEMPERATURE_BOUNDS : HOURS_BOUNDS })
    }
    // A follow-up field is always an hours-since value, even on a temperature criterion.
    if (criterion.also_field !== undefined) {
      fields.push({ name: criterion.also_field, bounds: HOURS_BOUNDS })
    }
  }

  return fields
}

function booleanFields(): readonly string[] {
  return CRITERIA.flatMap((criterion) => (criterion.flag === undefined ? [] : [criterion.flag]))
}

function buildParameters(): Readonly<Record<string, ToolPropertySchema>> {
  const properties: Record<string, ToolPropertySchema> = {}

  for (const criterion of CRITERIA) {
    if (criterion.field !== undefined) {
      properties[criterion.field] = {
        type: 'number',
        description: criterion.model_hint ?? criterion.rule,
      }
    }
    if (criterion.also_field !== undefined) {
      properties[criterion.also_field] = {
        type: 'number',
        description: criterion.also_model_hint ?? criterion.rule,
      }
    }
    if (criterion.flag !== undefined) {
      properties[criterion.flag] = {
        type: 'boolean',
        description: criterion.model_hint ?? criterion.rule,
      }
    }
  }

  // Two fields the criteria cannot describe: a fever with no readable number, and anything else.
  properties['temperatureUnknown'] = {
    type: 'boolean',
    description: 'True if a fever was mentioned but no readable number was given.',
  }
  properties[UNPARSED_FIELD] = {
    type: 'string',
    description:
      'Any symptom the parent described that does not fit the fields above. Put it here rather than guessing at a field.',
  }

  return properties
}

const DECLARATION: ToolDeclaration = {
  name: 'check_attendance',
  description: TOOL_DESCRIPTIONS.check_attendance,
  parameters: { type: 'object', properties: buildParameters() },
}

function execute(args: RawToolArgs): ToolResult {
  const numbers: Record<string, number | undefined> = {}
  for (const field of numericFields()) {
    const parsed = readNumber(args, field.name, field.bounds)
    if (!parsed.ok) return invalidArguments('check_attendance', parsed.problem)
    numbers[field.name] = parsed.value
  }

  const booleans: Record<string, boolean | undefined> = {}
  for (const name of [...booleanFields(), 'temperatureUnknown']) {
    const parsed = readBoolean(args, name)
    if (!parsed.ok) return invalidArguments('check_attendance', parsed.problem)
    booleans[name] = parsed.value
  }

  // Only defined fields are passed on: exactOptionalPropertyTypes forbids an explicit undefined.
  const report: SymptomReport = Object.fromEntries(
    Object.entries({
      ...numbers,
      ...booleans,
      [UNPARSED_FIELD]: readString(args, UNPARSED_FIELD),
    }).filter(([, value]) => value !== undefined),
  )

  const owner = findStaff(HEALTH_LEAD_ID)

  // The ladder decides on symptoms. With none reported there is nothing to decide on, and a
  // verdict on an empty report reads as a verdict on evidence the parent never gave.
  // FLOW: empty report -> needs_detail -> the model asks the parent -> the ladder decides
  // The tool names WHAT IS MISSING; the model does the asking, in its own words, the same
  // way get_hours asks which room a child is in. The guardrail is that it cannot reach a
  // verdict without this, not that a particular sentence is written here.
  if (Object.keys(report).length === 0) {
    return needsDetail(
      'check_attendance',
      'No symptoms were reported, so the rule has nothing to decide on. Ask the parent why they are asking -- it may be illness, and it may not be. If a symptom is named, call this again with it. If the reason is something else entirely, such as travel or a schedule question, route it accordingly.',
      { reason: 'no_symptoms_given' },
    )
  }

  const verdict = evaluateAttendance(report)

  const deferred = verdict.decision === 'may_attend' && !MAY_CLEAR_CHILD_TO_ATTEND
  const needsPerson = verdict.decision === 'ask_a_human' || deferred

  const detail = {
    decision: verdict.decision,
    ruleVerdict: verdict.decision,
    deferred,
    matchedCriterion: verdict.matchedCriterion,
    requiresDoctorNote: verdict.requiresDoctorNote,
  }

  if (deferred) {
    return {
      tool: 'check_attendance',
      outcome: 'needs_human',
      answer:
        'Nothing you have described is on our stay-home list, but I would rather a person confirm before your child comes in.',
      sourceId: null,
      citation: verdict.citation,
      routeTo: describeOwner(owner),
      detail,
    }
  }

  // A stay-home verdict is stated plainly and then handed to the Health Lead.
  // FLOW: stay_home -> the verdict, then the person who confirms a return -> the loop hands off
  // 1. it is not softened. The parent is told their child stays home, in those words.
  // 2. it does not state WHEN a child may return. That is a condition about a future day, and
  //    a model holding a condition and a date will do the arithmetic: asked "can she come in
  //    tomorrow" it answered yes, then defended the yes when the parent pushed back.
  // 3. routing ends the turn, so there is no follow-up for it to reason its way through. A
  //    return is confirmed by a person, which is what MAY_CLEAR_CHILD_TO_ATTEND always meant.
  if (verdict.decision === 'stay_home') {
    return {
      tool: 'check_attendance',
      outcome: 'needs_human',
      // The verdict is left exactly as the operator wrote it -- softening a stay-home is a
      // safety failure. Only the line AROUND it is warm.
      answer: `${verdict.reason}\n\nWe hope they feel better soon. **${owner.name}**, our ${owner.role}, confirms every return — call ${owner.phone} ext. ${owner.ext} when you are ready.`,
      sourceId: null,
      citation: verdict.citation,
      routeTo: describeOwner(owner),
      detail,
    }
  }

  return {
    tool: 'check_attendance',
    outcome: needsPerson ? 'needs_human' : 'answered',
    answer: verdict.reason,
    // A verdict cites the criterion that decided it, so an operator can trace any answer.
    sourceId: needsPerson ? null : `rule:attendance:${verdict.matchedCriterion ?? 'none'}`,
    citation: verdict.citation,
    routeTo: needsPerson ? describeOwner(owner) : null,
    detail,
  }
}

export const checkAttendanceTool: Tool = { declaration: DECLARATION, execute }
