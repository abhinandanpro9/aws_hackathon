import centerData from '../../data/center.json' with { type: 'json' }
import { FRONT_DESK_CAN_TAKE_ACTIONS } from '../config/policy.js'
import { TOOL_DESCRIPTIONS } from '../config/tools.js'
import { canBook, nextAvailable, openSlots } from '../rules/booking.js'
import { needsDetail, readDate, readString } from './shared/args.js'
import { describeOwner, findStaff } from './shared/staff.js'
import type { RawToolArgs, Tool, ToolContext, ToolDeclaration, ToolResult } from '../types/tools.js'

// The desk's first action tool, and the gate that keeps it an answer for now.
// FLOW: model fills date + time -> slot validated against real bookings -> gate decides:
//       write when FRONT_DESK_CAN_TAKE_ACTIONS, hand to the booking owner while it is off
// 1. the validation runs either way, so a parent hears "that slot is taken" before calling
// 2. the gate lives HERE in code: a model that wants to book cannot talk past it
// 3. flipping the flag changes what this tool does, not how anything routes

const TOUR_TIMES: readonly string[] = centerData.tours.times
const BOOKING_OWNER_ID: string = centerData.tours.booking_owner

const DECLARATION: ToolDeclaration = {
  name: 'book_tour',
  description: TOOL_DESCRIPTIONS.book_tour,
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'The day the parent wants, as YYYY-MM-DD. Work the date out before calling.',
      },
      time: {
        type: 'string',
        description: 'Which tour slot they want.',
        enum: TOUR_TIMES,
      },
    },
    required: ['date', 'time'],
  },
}

function execute(args: RawToolArgs, context?: ToolContext): ToolResult {
  const bookings = context?.bookings ?? []
  const owner = findStaff(BOOKING_OWNER_ID)

  const { date, unreadable } = readDate(args, 'date')
  if (unreadable !== undefined || date === undefined) {
    return needsDetail(
      'book_tour',
      `"${unreadable ?? ''}" is not a date this can check. Work the day out and pass it as YYYY-MM-DD, or ask the parent which day they meant.`,
      { requestedDate: unreadable ?? null },
    )
  }

  const time = readString(args, 'time') ?? ''
  const nowIso = new Date().toISOString()
  const verdict = canBook(date, time, bookings, nowIso)

  if (!verdict.ok) {
    const open = openSlots(date, bookings, nowIso)
    const next = open.length > 0 ? null : nextAvailable(date, bookings, nowIso)

    // A slot we can still offer is a question, not a hand-off.
    // FLOW: taken -> something else open? -> name it and keep the turn : send to the owner
    // 1. needs_human ends the conversation, so using it while 13:30 sits free strands a
    //    parent on a phone number for a booking the desk could have taken
    // 2. only a day with nothing open, and no next date to suggest, is really a person's job
    if (open.length > 0 || next !== null) {
      const offer =
        open.length > 0
          ? `Still open that day: ${open.join(' and ')}.`
          : `The next open tour is ${next?.date} at ${next?.time}.`
      return {
        tool: 'book_tour',
        outcome: 'answered',
        answer: `${verdict.problem} ${offer} Tell me which one suits you and I will book it.`,
        sourceId: 'center:tours',
        citation: null,
        routeTo: null,
        detail: { requestedDate: date, requestedTime: time, slotOk: false, offered: true },
      }
    }

    return {
      tool: 'book_tour',
      outcome: 'needs_human',
      answer: `${verdict.problem}

**${owner.name}**, our ${owner.role}, books tours — call ${owner.phone} ext. ${owner.ext}.`,
      sourceId: 'center:tours',
      citation: null,
      routeTo: describeOwner(owner),
      detail: { requestedDate: date, requestedTime: time, slotOk: false },
    }
  }

  // The slot is real and free. Whether the desk may act on that is the gate's call.
  if (!FRONT_DESK_CAN_TAKE_ACTIONS) {
    return {
      tool: 'book_tour',
      outcome: 'needs_human',
      answer: `The ${time} tour on ${date} is open. I cannot book it myself — **${owner.name}**, our ${owner.role}, will hold it for you. Call ${owner.phone} ext. ${owner.ext}.`,
      sourceId: 'center:tours',
      citation: null,
      routeTo: describeOwner(owner),
      detail: { requestedDate: date, requestedTime: time, slotOk: true, gated: true },
    }
  }

  // The gate is open: the actual write happens in the server layer, which owns the store.
  return {
    tool: 'book_tour',
    outcome: 'answered',
    answer: `Booked: the ${time} tour on ${date}. It runs about ${centerData.tours.duration_minutes} minutes.`,
    sourceId: 'center:tours',
    citation: 'Sunflower Grove tour calendar',
    routeTo: null,
    detail: { requestedDate: date, requestedTime: time, slotOk: true, book: true },
  }
}

export const bookTourTool: Tool = { declaration: DECLARATION, execute }
