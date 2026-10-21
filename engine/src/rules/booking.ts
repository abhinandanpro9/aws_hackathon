import centerData from '../../data/center.json' with { type: 'json' }
import { CENTER_TIMEZONE, centerToday, weekdayName } from './schedule.js'

// Tour slots and whether one can be booked.
// FLOW: tour days + times from center data -> minus taken slots -> open slots
// 1. only one tour runs at a time; slots are fixed, so "no overlaps" is "slot not taken"
// 2. everything decides from data a code path can check; the model only fills the form
// 3. writing a booking is a separate, gated act -- these rules only ever read

export interface TourBooking {
  readonly date: string
  readonly time: string
}

const TOUR_DAYS: readonly string[] = centerData.tours.days
const TOUR_TIMES: readonly string[] = centerData.tours.times

// Closures beat the weekly pattern, exactly as an operating schedule's special days do.
const CLOSED_DATES: ReadonlySet<string> = new Set(
  centerData.closures.published_holidays_2026_2027.map((holiday) => holiday.date),
)

/** The wall clock at the center as HH:MM, so "today's 9:30" can be recognised as gone. */
function centerClock(nowIso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CENTER_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(nowIso))
}

/** Whether a slot on a date is already in the past, by the center's own clock. */
function slotHasPassed(isoDate: string, time: string, nowIso: string | undefined): boolean {
  if (nowIso === undefined) return false
  return isoDate === centerToday(nowIso) && time <= centerClock(nowIso)
}

export function isTourDay(isoDate: string): boolean {
  return TOUR_DAYS.includes(weekdayName(isoDate)) && !CLOSED_DATES.has(isoDate)
}

/** The slot times still free on a date. Empty when tours do not run that day. */
export function openSlots(
  isoDate: string,
  bookings: readonly TourBooking[],
  nowIso?: string,
): readonly string[] {
  if (!isTourDay(isoDate)) return []
  const taken = new Set(bookings.filter((b) => b.date === isoDate).map((b) => b.time))
  return TOUR_TIMES.filter((time) => !taken.has(time) && !slotHasPassed(isoDate, time, nowIso))
}

/** How far ahead to look before saying nothing is open. Two months of tour days. */
const SEARCH_DAYS = 60

/**
 * The next open slot on or after a date.
 * FLOW: walk forward one day at a time -> first day with an open slot -> earliest time wins
 * Null after SEARCH_DAYS: an honest "nothing for two months" beats an unbounded walk.
 */
export function nextAvailable(
  fromIsoDate: string,
  bookings: readonly TourBooking[],
  nowIso?: string,
): { readonly date: string; readonly time: string } | null {
  const start = Date.parse(`${fromIsoDate}T00:00:00Z`)
  if (!Number.isFinite(start)) return null

  for (let day = 0; day < SEARCH_DAYS; day += 1) {
    const date = new Date(start + day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const open = openSlots(date, bookings, nowIso)
    const first = open[0]
    if (first !== undefined) return { date, time: first }
  }
  return null
}

export type BookVerdict = { readonly ok: true } | { readonly ok: false; readonly problem: string }

/** Whether a slot could be booked. The verdict, not the act: writing is gated elsewhere. */
export function canBook(
  isoDate: string,
  time: string,
  bookings: readonly TourBooking[],
  nowIso?: string,
): BookVerdict {
  if (CLOSED_DATES.has(isoDate)) {
    return { ok: false, problem: 'The center is closed that day.' }
  }
  if (!isTourDay(isoDate)) {
    return { ok: false, problem: `Tours run on ${TOUR_DAYS.join(' and ')} only.` }
  }
  if (!TOUR_TIMES.includes(time)) {
    return { ok: false, problem: `Tours start at ${TOUR_TIMES.join(' and ')} only.` }
  }
  if (slotHasPassed(isoDate, time, nowIso)) {
    return { ok: false, problem: "That time has already passed today." }
  }
  if (!openSlots(isoDate, bookings, nowIso).includes(time)) {
    return { ok: false, problem: 'That slot is already taken.' }
  }
  return { ok: true }
}
