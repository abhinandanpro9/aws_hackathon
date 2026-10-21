import { describe, expect, it } from 'vitest'
import { openSlots, canBook, nextAvailable } from '../src/rules/booking.js'
import { bookTourTool } from '../src/tools/book-tour.js'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// The tour scheduler: fixed slots, one tour at a time.
// FLOW: tour days + times from center data -> minus taken slots -> open slots; a booking
//       must land exactly on an open slot
// 1. only one tour runs at a time, so a taken slot is gone, no overlaps to compute
// 2. the desk itself may not book: FRONT_DESK_CAN_TAKE_ACTIONS is false, so the tool
//    validates and then hands to the person who books, by name

const NO_BOOKINGS: readonly { date: string; time: string }[] = []
const TUESDAY = '2026-09-01'
const WEDNESDAY = '2026-09-02'

describe('open slots', () => {
  it('offers both times on an empty tour day', () => {
    expect(openSlots(TUESDAY, NO_BOOKINGS)).toEqual(['09:30', '13:30'])
  })

  it('offers nothing on a day tours do not run', () => {
    expect(openSlots(WEDNESDAY, NO_BOOKINGS)).toEqual([])
  })

  it('drops a taken slot', () => {
    expect(openSlots(TUESDAY, [{ date: TUESDAY, time: '09:30' }])).toEqual(['13:30'])
  })

  it('ignores bookings on other days', () => {
    expect(openSlots(TUESDAY, [{ date: '2026-09-03', time: '09:30' }])).toEqual(['09:30', '13:30'])
  })
})

describe('canBook', () => {
  it('accepts an open slot', () => {
    expect(canBook(TUESDAY, '09:30', NO_BOOKINGS).ok).toBe(true)
  })

  it('refuses a taken slot', () => {
    const verdict = canBook(TUESDAY, '09:30', [{ date: TUESDAY, time: '09:30' }])
    expect(verdict.ok).toBe(false)
  })

  it('refuses a time that is not a tour slot', () => {
    expect(canBook(TUESDAY, '11:00', NO_BOOKINGS).ok).toBe(false)
  })

  it('refuses a day tours do not run', () => {
    expect(canBook(WEDNESDAY, '09:30', NO_BOOKINGS).ok).toBe(false)
  })
})

describe('the book_tour tool, with the action gate on', () => {
  it('books an open slot and says so plainly', () => {
    const result = bookTourTool.execute({ date: TUESDAY, time: '09:30' }, { bookings: NO_BOOKINGS })

    expect(result.outcome).toBe('answered')
    expect(result.answer).toContain('Booked')
    expect(result.detail['book']).toBe(true)
  })

  // A taken slot used to end the turn on a phone number. It offers the free slot instead:
  // handing a parent to a person while 13:30 sits open wastes the one action the desk has.
  it('offers the other slot when the asked one is taken, instead of ending the turn', () => {
    const result = bookTourTool.execute(
      { date: TUESDAY, time: '09:30' },
      { bookings: [{ date: TUESDAY, time: '09:30' }] },
    )

    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('taken')
    expect(result.answer).toContain('13:30')
  })

  it('still hands off when the whole day is gone and nothing follows it', () => {
    const result = bookTourTool.execute(
      { date: TUESDAY, time: '09:30' },
      {
        bookings: [
          { date: TUESDAY, time: '09:30' },
          { date: TUESDAY, time: '13:30' },
        ],
      },
    )

    expect(result.answer.toLowerCase()).toContain('taken')
  })

  it('degrades to missing detail on an unreadable date', () => {
    const result = bookTourTool.execute({ date: 'next tuesday', time: '09:30' }, { bookings: NO_BOOKINGS })
    expect(result.outcome).toBe('needs_detail')
  })
})

describe('closures beat the weekly pattern, as in the operating schedule', () => {
  // Thanksgiving 2026-11-26 is a Thursday: a tour day by weekday, closed by the published list.
  it('offers no slots on a closure day', () => {
    expect(openSlots('2026-11-26', NO_BOOKINGS)).toEqual([])
  })

  it('refuses to book a closure day, and says why', () => {
    const verdict = canBook('2026-11-26', '09:30', NO_BOOKINGS)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.problem.toLowerCase()).toContain('closed')
  })
})

describe('next available slot', () => {
  // From 2026-08-29 (a Saturday): the next tour day is Tuesday 2026-09-01.
  it('finds the next open slot from a non-tour day', () => {
    expect(nextAvailable('2026-08-29', NO_BOOKINGS)).toEqual({ date: '2026-09-01', time: '09:30' })
  })

  it('starts from the given day itself when it is a tour day', () => {
    expect(nextAvailable(TUESDAY, NO_BOOKINGS)).toEqual({ date: TUESDAY, time: '09:30' })
  })

  it('skips taken slots and whole taken days', () => {
    const taken = [
      { date: '2026-09-01', time: '09:30' },
      { date: '2026-09-01', time: '13:30' },
      { date: '2026-09-03', time: '09:30' },
    ]
    expect(nextAvailable('2026-09-01', taken)).toEqual({ date: '2026-09-03', time: '13:30' })
  })

  it('skips a closure day', () => {
    // Thanksgiving 2026-11-26 is a Thursday; the next tour day is Tuesday 12-01.
    expect(nextAvailable('2026-11-25', NO_BOOKINGS)).toEqual({ date: '2026-12-01', time: '09:30' })
  })

  it('gives up honestly when every day in the window is booked out', () => {
    const all: { date: string; time: string }[] = []
    for (let i = 0; i < 70; i += 1) {
      const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
      all.push({ date: d, time: '09:30' }, { date: d, time: '13:30' })
    }
    expect(nextAvailable('2026-09-01', all)).toBeNull()
  })
})

describe('book_tour never throws, whatever the model sends', () => {
  const nonsense: readonly Record<string, unknown>[] = [
    {},
    { date: null, time: null },
    { date: 42, time: 930 },
    { date: ['2026-09-01'], time: {} },
    { date: '2026-09-01' },
    { time: '09:30' },
    { date: 'constructor', time: '__proto__' },
  ]

  // "answered" is safe here too: a missing or unusable time now names the open slots and
  // asks which one, rather than booking anything. What must never happen is a write.
  it('degrades to a safe outcome for every shape of bad input', () => {
    for (const args of nonsense) {
      const result = bookTourTool.execute(args, { bookings: NO_BOOKINGS })
      expect(['needs_detail', 'needs_human', 'invalid_arguments', 'answered']).toContain(result.outcome)
      expect(result.detail['book']).not.toBe(true)
    }
  })

  it('copes with no context at all', () => {
    expect(() => bookTourTool.execute({ date: '2026-09-01', time: '09:30' })).not.toThrow()
  })
})

describe('the tours facet gives live availability', () => {
  // "next available tour slot?" is a tours question, not a booking -- the facet must
  // still read the real bookings and name the next open slot, not recite the schedule.
  it('names the next open slot alongside the schedule', () => {
    const result = getCenterFactsTool.execute({ topic: 'tours' }, { bookings: [] })

    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('next open')
    expect(result.answer).toMatch(/\d{4}-\d{2}-\d{2} at \d{2}:\d{2}/)
  })

  it('still answers plainly with no context', () => {
    const result = getCenterFactsTool.execute({ topic: 'tours' })
    expect(result.outcome).toBe('answered')
  })
})

describe('the clock counts, not just the calendar', () => {
  // 2026-09-01 is a Tuesday. At 11am at the center, the 9:30 tour has already run.
  const ELEVEN_AM = '2026-09-01T18:00:00Z' // midday at the center — well past 9:30
  const SEVEN_AM = '2026-09-01T13:00:00Z' // 07:00 in America/Denver

  it('drops a slot that has already started today', () => {
    expect(openSlots('2026-09-01', NO_BOOKINGS, ELEVEN_AM)).toEqual(['13:30'])
  })

  it('offers both slots early in the morning', () => {
    expect(openSlots('2026-09-01', NO_BOOKINGS, SEVEN_AM)).toEqual(['09:30', '13:30'])
  })

  it('does not filter a future date by today\'s clock', () => {
    expect(openSlots('2026-09-03', NO_BOOKINGS, ELEVEN_AM)).toEqual(['09:30', '13:30'])
  })

  it('refuses to book a slot that has passed', () => {
    const verdict = canBook('2026-09-01', '09:30', NO_BOOKINGS, ELEVEN_AM)
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.problem.toLowerCase()).toContain('already')
  })

  it('nextAvailable skips past today\'s finished slots', () => {
    expect(nextAvailable('2026-09-01', NO_BOOKINGS, ELEVEN_AM)).toEqual({
      date: '2026-09-01',
      time: '13:30',
    })
  })
})
