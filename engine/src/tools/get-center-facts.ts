import centerData from '../../data/center.json' with { type: 'json' }
import { TOOL_DESCRIPTIONS } from '../config/tools.js'
import {
  CENTER_TIMEZONE,
  CLOSURE_KINDS,
  answerClosure,
  answerHours,
  answerTours,
  centerToday,
  weekdayName,
  type ClosureAsk,
} from '../rules/schedule.js'
import { nextAvailable } from '../rules/booking.js'
import {
  invalidArguments,
  needsDetail,
  needsHuman,
  readBoolean,
  readDate,
  readString,
} from './shared/args.js'
import type { RawToolArgs, Tool, ToolContext, ToolDeclaration, ToolResult } from '../types/tools.js'

// Every static fact about the center, behind one faceted tool.
// FLOW: model picks topic -> that topic's own rule -> result, with the facet in the source id
// 1. the model routes on four tool names instead of eight; deciding still happens here in code
// 2. each topic validates its own args exactly as the five standalone tools did
// 3. an unknown or hostile topic is missing detail, never a guess and never a crash

const PROGRAM_IDS: readonly string[] = centerData.programs.map((program) => program.id)

const FACT_TOPICS = ['hours', 'closures', 'tours', 'today', 'about'] as const
type FactTopic = (typeof FACT_TOPICS)[number]

const DECLARATION: ToolDeclaration = {
  name: 'get_center_facts',
  description: TOOL_DESCRIPTIONS.get_center_facts,
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'Which fact is being asked for: "hours" for opening and closing times, "closures" for whether a day is open, "tours" for visiting, "today" for the current date, "about" for what the center is like.',
        enum: FACT_TOPICS,
      },
      programId: {
        type: 'string',
        description:
          'Which room the child is in, if the parent said. Rooms finish at different times, so leave this out rather than guessing.',
        enum: PROGRAM_IDS,
      },
      date: {
        type: 'string',
        description:
          'The day being asked about as YYYY-MM-DD, ONLY when the parent named one. Leave it out for "today" unless they said a day.',
      },
      ask: {
        type: 'string',
        description:
          'For topic "closures": use specific_day when the parent named a day; weather for snow or storms; holiday_calendar for holidays or closure dates generally.',
        enum: CLOSURE_KINDS,
      },
      wantsToBook: {
        type: 'boolean',
        description: 'For topic "tours": true when the parent wants a tour booked, not just the times.',
      },
    },
    required: ['topic'],
  },
}

// ─── hours ───

function factHours(args: RawToolArgs): ToolResult {
  const programId = readString(args, 'programId')

  if (programId !== undefined && !PROGRAM_IDS.includes(programId)) {
    return needsHuman('get_center_facts', 'I do not know that room, so I am passing this to a person.', {
      requestedProgram: programId,
    })
  }

  const { date, unreadable } = readDate(args, 'date')
  if (unreadable !== undefined) return unreadableDate(unreadable)

  const answer = answerHours({
    ...(programId === undefined ? {} : { programId }),
    ...(date === undefined ? {} : { date }),
  })

  return {
    tool: 'get_center_facts',
    outcome: answer.kind === 'needs_program' ? 'needs_detail' : 'answered',
    answer: answer.message,
    sourceId: 'center:hours',
    citation: answer.citation,
    routeTo: answer.routeTo,
    detail: { topic: 'hours', kind: answer.kind, programId: programId ?? null },
  }
}

// ─── closures ───

function factClosures(args: RawToolArgs): ToolResult {
  const rawAsk = readString(args, 'ask')

  const { date, unreadable } = readDate(args, 'date')
  if (unreadable !== undefined) return unreadableDate(unreadable)

  if (rawAsk === undefined || !(CLOSURE_KINDS as readonly string[]).includes(rawAsk)) {
    return needsHuman('get_center_facts', 'I am not sure which day you mean, so a person will pick this up.', {
      requestedAsk: rawAsk ?? null,
    })
  }

  const ask = rawAsk as ClosureAsk
  const answer = answerClosure({ ask, ...(date !== undefined ? { date } : {}) })
  const handedOff = answer.kind !== 'answered'

  return {
    tool: 'get_center_facts',
    outcome: handedOff ? 'needs_human' : 'answered',
    answer: answer.message,
    sourceId: handedOff ? null : 'center:closures',
    citation: answer.citation,
    routeTo: answer.routeTo,
    detail: { topic: 'closures', kind: answer.kind, ask, date: date ?? null },
  }
}

// ─── tours ───

function factTours(args: RawToolArgs, context?: ToolContext): ToolResult {
  const parsed = readBoolean(args, 'wantsToBook')
  if (!parsed.ok) return invalidArguments('get_center_facts', parsed.problem)

  const wantsToBook = parsed.value ?? false

  const { date, unreadable } = readDate(args, 'date')
  if (unreadable !== undefined) return unreadableDate(unreadable)

  const answer = answerTours({ wantsToBook, ...(date === undefined ? {} : { date }) })
  const handedOff = answer.kind !== 'answered'

  // The schedule says when tours run; the bookings say which slot is actually next.
  // "Next available tour?" deserves the live answer, not a recital of the pattern.
  const nowIso = new Date().toISOString()
  const from = date ?? centerToday(nowIso)
  const next = handedOff ? null : nextAvailable(from, context?.bookings ?? [], nowIso)
  const withNext =
    next === null ? answer.message : `${answer.message}

The next open tour is ${next.date} at ${next.time}.`

  return {
    tool: 'get_center_facts',
    outcome: handedOff ? 'needs_human' : 'answered',
    answer: withNext,
    sourceId: handedOff ? null : 'center:tours',
    citation: answer.citation,
    routeTo: answer.routeTo,
    detail: { topic: 'tours', kind: answer.kind, wantsToBook },
  }
}

// ─── today ───

const WEEKEND = new Set(['Saturday', 'Sunday'])

function factToday(_args: RawToolArgs): ToolResult {
  const date = centerToday(new Date().toISOString())
  const weekday = weekdayName(date)
  const isWeekday = !WEEKEND.has(weekday)

  return {
    tool: 'get_center_facts',
    outcome: 'answered',
    answer: `Today is ${weekday}, ${date} at the center (${CENTER_TIMEZONE}). ${
      isWeekday
        ? 'That is a weekday, so the center runs its normal hours unless a closure applies.'
        : 'That is a weekend, and the center is only open Monday to Friday.'
    }`,
    sourceId: 'center:today',
    citation: null,
    routeTo: null,
    detail: { topic: 'today', date, weekday, isWeekday },
  }
}

// ─── about ───

/** Months read as ages a parent would say: 6 months, 2 years, 5 years. */
function asAge(months: number): string {
  if (months < 24) return `${months} months`
  const years = Math.floor(months / 12)
  return `${years} years`
}

function factAbout(_args: RawToolArgs): ToolResult {
  const { center, programs } = centerData

  const youngest = Math.min(...programs.map((p) => p.age_min_months))
  const oldest = Math.max(...programs.map((p) => p.age_max_months))

  const rooms = programs
    .map((p) => `- ${p.name}: ${asAge(p.age_min_months)} to ${asAge(p.age_max_months)}`)
    .join('\n')

  const answer = `${center.name} takes children from ${asAge(youngest)} to ${asAge(oldest)}, across ${programs.length} rooms:

${rooms}

${center.accreditation}. We are at ${center.address}, on ${center.phone}.`

  return {
    tool: 'get_center_facts',
    outcome: 'answered',
    answer,
    sourceId: 'center:about',
    citation: 'Sunflower Grove centre record',
    routeTo: null,
    detail: { topic: 'about', rooms: programs.length },
  }
}

// ─── dispatch ───

function unreadableDate(unreadable: string): ToolResult {
  return needsDetail(
    'get_center_facts',
    `"${unreadable}" is not a date this can check. Work the day out and pass it as YYYY-MM-DD, or ask the parent which day they meant.`,
    { requestedDate: unreadable },
  )
}

const EXECUTE_BY_TOPIC: Readonly<Record<FactTopic, (args: RawToolArgs, context?: ToolContext) => ToolResult>> = {
  hours: factHours,
  closures: factClosures,
  tours: factTours,
  today: factToday,
  about: factAbout,
}

function isFactTopic(value: string): value is FactTopic {
  return (FACT_TOPICS as readonly string[]).includes(value)
}

function execute(args: RawToolArgs, context?: ToolContext): ToolResult {
  const topic = readString(args, 'topic')
  // Membership check, never a bare Record lookup: a topic like "constructor" would hit the
  // prototype and hand back a function instead of a tool.
  const run = topic !== undefined && isFactTopic(topic) ? EXECUTE_BY_TOPIC[topic] : undefined

  if (run === undefined) {
    return needsDetail(
      'get_center_facts',
      `"${topic ?? ''}" is not a fact this holds. It knows: ${FACT_TOPICS.join(', ')}. Pick the closest, or hand the question to a person.`,
      { requestedTopic: topic ?? null },
    )
  }

  return run(args, context)
}

export const getCenterFactsTool: Tool = { declaration: DECLARATION, execute }
