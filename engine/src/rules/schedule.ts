// Hours, closures, and tours. The three questions a center answers most, done properly.
// FLOW: question -> resolve what we actually know -> answer, ask one thing, or hand off
// 1. hours depend on WHICH child; an averaged closing time is wrong for most parents here
// 2. closures run an ordered ladder, and the order is the whole contract
// 3. nothing here books anything -- an action request names a person and a number
// WHY: closures must be checked before the weekly pattern; the wrong order is a known bug of this shape

import centerData from '../../data/center.json' with { type: 'json' }
import { CITATIONS, FRONT_DESK_CAN_TAKE_ACTIONS } from '../config/policy.js'

// ─── Shared shapes ───

export const SCHEDULE_KINDS = ['answered', 'needs_program', 'known_gap', 'owned_elsewhere', 'hand_off'] as const
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]

export interface ScheduleAnswer {
  readonly kind: ScheduleKind
  readonly message: string
  readonly citation: string | null
  readonly routeTo: string | null
}

interface Owner {
  readonly name: string
  readonly role: string
  readonly phone: string
  readonly ext: string
}

function staffById(id: string): Owner {
  const found = centerData.staff.find((s) => s.id === id) ?? centerData.staff[0]
  if (found === undefined) throw new Error('Center data has no staff.')
  return found
}

function describe(owner: Owner): string {
  return `${owner.name}, ${owner.role} (${owner.phone} ext. ${owner.ext})`
}

/** 07:30 -> 7:30am, so a parent reads it the way they would say it. */
function friendlyTime(time: string): string {
  const [rawHour, minute] = time.split(':')
  const hour = Number(rawHour ?? '0')
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minute ?? '00'}${suffix}`
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

function weekdayOf(isoDate: string): string {
  const day = new Date(`${isoDate}T12:00:00`).getDay()
  return WEEKDAY_NAMES[day] ?? 'that day'
}

function isWeekend(isoDate: string): boolean {
  const day = new Date(`${isoDate}T12:00:00`).getDay()
  return day === 0 || day === 6
}

/** The centre's own clock. A parent asking "today" means the centre's day, not the server's. */
export const CENTER_TIMEZONE: string = centerData.center.timezone

/**
 * What day it is where the centre is.
 * FLOW: instant (askedAt) -> centre timezone -> YYYY-MM-DD
 * A parent asking at 9pm Pacific is asking about a day that is already tomorrow in UTC, so
 * the server's date would answer for the wrong day every evening.
 */
export function centerToday(askedAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(askedAt))

  // en-CA formats as YYYY-MM-DD, which is the shape every rule here already reads.
  return parts
}

/** The weekday name for a date, so a reply can say Sunday rather than 2026-08-09. */
export function weekdayName(isoDate: string): string {
  return weekdayOf(isoDate)
}

// ─── Hours ───

export interface HoursQuestion {
  readonly programId?: string
  readonly date?: string
}

/**
 * Answer closing and opening times for a specific program.
 * With no program we ask, because the infant room closes three hours after Pre-K.
 */
export function answerHours(question: HoursQuestion): ScheduleAnswer {
  const program = centerData.programs.find((p) => p.id === question.programId)

  if (program === undefined) {
    return {
      kind: 'needs_program',
      message: `Happy to check. Our rooms finish at different times — **which room is your child in?**

${centerData.programs.map((p) => `- ${p.name}`).join('\n')}`,
      citation: CITATIONS.hours,
      routeTo: null,
    }
  }

  if (question.date !== undefined && isWeekend(question.date)) {
    return {
      kind: 'answered',
      message: `We are closed at weekends. ${program.name} runs Monday to Friday, ${friendlyTime(program.program_hours.open)} to ${friendlyTime(program.program_hours.close)}.`,
      citation: CITATIONS.hours,
      routeTo: null,
    }
  }

  const core = `**${program.name}** runs ${friendlyTime(program.program_hours.open)} to ${friendlyTime(program.program_hours.close)}.`
  // Extended care is a separate fact from the room's own hours, so it gets its own line
  // rather than trailing off the end of one long sentence.
  const extended =
    'extended_care' in program && program.extended_care !== undefined
      ? `

Extended care also runs:
- ${friendlyTime(program.extended_care.before.open)} to ${friendlyTime(program.extended_care.before.close)} in the morning
- ${friendlyTime(program.extended_care.after.open)} to ${friendlyTime(program.extended_care.after.close)} in the afternoon`
      : ''

  return { kind: 'answered', message: `${core}${extended}`, citation: CITATIONS.hours, routeTo: null }
}


// ─── Closures ───

/** What the question is about, as the model classified it. Never guessed from wording. */
export const CLOSURE_KINDS = ['specific_day', 'weather', 'holiday_calendar'] as const
export type ClosureAsk = (typeof CLOSURE_KINDS)[number]

export interface ClosureQuestion {
  readonly date?: string
  /** What the parent is asking about, decided by the model, not matched from their words. */
  readonly ask?: ClosureAsk
}

/** The last year the published list speaks for. Read from the data, never a hardcoded year. */
function lastPublishedYear(): string {
  return [...centerData.closures.published_holidays_2026_2027].map((h) => h.date.slice(0, 4)).sort().at(-1) ?? ''
}

/**
 * Whether a date falls in the school years the closure list actually covers.
 * FLOW: published dates -> the calendar years they span -> is this date inside those years?
 * 1. the bound is the YEARS named, not the first-to-last holiday: term time between and
 *    around the holidays is covered too, and an ordinary weekday must still answer "open"
 * 2. a date outside is unknown, not open -- the list cannot speak for a year it never mentions
 */
function withinPublishedCalendar(date: string): boolean {
  const years = [...centerData.closures.published_holidays_2026_2027].map((h) => h.date.slice(0, 4)).sort()
  const first = years[0]
  const last = years.at(-1)
  if (first === undefined || last === undefined) return false
  const year = date.slice(0, 4)
  return year >= first && year <= last
}

/**
 * Decide whether the center is open. Ordered, first match wins.
 * FLOW: published holiday -> weekend -> weather -> calendar we do not hold -> open
 * 1. the order is the contract: a published date beats anything vaguer
 * 2. the KIND of question arrives already classified; this rule never reads prose
 */
export function answerClosure(question: ClosureQuestion): ScheduleAnswer {
  // 1. A date we actually published beats everything else.
  if (question.date !== undefined) {
    const holiday = centerData.closures.published_holidays_2026_2027.find((h) => h.date === question.date)
    if (holiday !== undefined) {
      return {
        kind: 'answered',
        message: `We are closed on ${holiday.name}, so there is no care that day.`,
        citation: CITATIONS.closures,
        routeTo: null,
      }
    }
    if (isWeekend(question.date)) {
      return {
        kind: 'answered',
        message: 'We are closed at weekends — we run Monday to Friday. Hope that helps.',
        citation: CITATIONS.closures,
        routeTo: null,
      }
    }
  }

  // 2. Weather belongs to the school district, but a parent cannot call a district.
  // The message names the district as the authority; the ROUTE is our own staff member from
  // owner_id, with a number -- the contact card used to show "Fairmont School District" and
  // nothing to dial.
  if (question.ask === 'weather') {
    const owner = staffById(centerData.closures.weather.owner_id)
    return {
      kind: 'owned_elsewhere',
      message: `${centerData.closures.weather.policy}

${centerData.closures.weather.note}

If you are unsure, **${owner.name}** can tell you what today's announcement means for us — call ${owner.phone} ext. ${owner.ext}.`,
      citation: CITATIONS.closures,
      routeTo: describe(owner),
    }
  }

  // 3. The whole closure list, read back. The published dates ARE the calendar, so this is
  // an answer rather than a hand-off: there is no second list held somewhere else.
  if (question.ask === 'holiday_calendar') {
    const dates = centerData.closures.published_holidays_2026_2027
      .map((h) => `- ${h.name}, ${weekdayOf(h.date)} ${h.date}`)
      .join('\n')

    return {
      kind: 'answered',
      message: `Happy to run through it. We are closed on these days, and at weekends:

${dates}`,
      citation: CITATIONS.closures,
      routeTo: null,
    }
  }

  // 4. Nothing says otherwise, but only INSIDE the years the list covers.
  // FLOW: date -> published holiday -> weekend -> within the calendar ? open : ask a person
  // 1. absence from a two-school-year list is evidence about those two years and nothing else
  // 2. beyond it the honest answer is that the calendar is not published yet
  // WHY: "Are you open on January 1, 2032?" was answered "yes, open" at full confidence --
  // New Year's Day, six years out, from a list ending 2027-07-05 [2026-08-27]
  if (question.date !== undefined) {
    if (!withinPublishedCalendar(question.date)) {
      const owner = staffById(centerData.closures.weather.owner_id)
      return {
        kind: 'owned_elsewhere',
        message: `Our closure calendar only runs to the end of ${lastPublishedYear()}, so I cannot say for ${question.date} yet.

**${owner.name}** can tell you as soon as that year is published — call ${owner.phone} ext. ${owner.ext}.`,
        citation: CITATIONS.closures,
        routeTo: describe(owner),
      }
    }

    return {
      kind: 'answered',
      message: `We are open that day, ${weekdayOf(question.date)}, ${friendlyTime(centerData.hours.center_open)} to ${friendlyTime(centerData.hours.center_close)}.`,
      citation: CITATIONS.closures,
      routeTo: null,
    }
  }

  // No date and no kind of question we recognise. Asking is better than guessing, and there
  // is no second calendar to point at: the published list is all there is.
  return {
    kind: 'needs_program',
    message: 'Happy to check — which day did you mean? Give me the date and I can look it up.',
    citation: null,
    routeTo: null,
  }
}

// ─── Tours ───

export interface TourQuestion {
  readonly date?: string
  /** True when the parent is asking to book, not asking when tours run. */
  readonly wantsToBook?: boolean
}

/** Report when tours run. Booking is a person's job, not ours. */
export function answerTours(question: TourQuestion): ScheduleAnswer {
  const tours = centerData.tours
  const owner = staffById(tours.booking_owner)

  const dayList = tours.days.join(' and ')
  const timeList = tours.times.map(friendlyTime).join(' and ')
  const times = `Tours run ${dayList} at ${timeList}, and last about ${tours.duration_minutes} minutes.`

  // The switch decides, not this rule. Hardcoding the refusal here behaved correctly and made
  // FRONT_DESK_CAN_TAKE_ACTIONS decoration: flipping it changed nothing.
  if (question.wantsToBook === true && !FRONT_DESK_CAN_TAKE_ACTIONS) {
    return {
      kind: 'hand_off',
      message: `${times}

I cannot book one for you, but **${owner.name}** can — call ${owner.phone} ext. ${owner.ext}.`,
      citation: CITATIONS.tours,
      routeTo: describe(owner),
    }
  }

  if (question.date !== undefined) {
    const day = weekdayOf(question.date)
    if (tours.days.includes(day)) {
      return {
        kind: 'answered',
        message: `Yes — we run tours on ${day} at ${timeList}. We would love to show you around.`,
        citation: CITATIONS.tours,
        routeTo: null,
      }
    }

    // Next tour day after this one, wrapping the week.
    const todayIndex = WEEKDAY_NAMES.indexOf(day as (typeof WEEKDAY_NAMES)[number])
    const next =
      tours.days.find((d) => WEEKDAY_NAMES.indexOf(d as (typeof WEEKDAY_NAMES)[number]) > todayIndex) ??
      tours.days[0] ??
      'Tuesday'

    return {
      kind: 'answered',
      message: `We do not run tours on ${day}, but the next one is ${next} at ${timeList}.`,
      citation: CITATIONS.tours,
      routeTo: null,
    }
  }

  return { kind: 'answered', message: times, citation: CITATIONS.tours, routeTo: null }
}
