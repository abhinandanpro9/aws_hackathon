import { describe, expect, it } from 'vitest'
import { answerQuestion } from '../src/pipeline/answer.js'
import type { LlmClient } from '../src/types/llm.js'

// One message is often four messages; a hand-off must not eat the other three.
// FLOW: model batches tools -> one routes to a person -> answered facts + every route survive
// 1. real probe, 2026-08-25. Vomit + hours + tuition + ex-at-pickup in one message: the reply
//    carried only the stay-home line. Hours were fetched and thrown away, and the custody
//    escalation was dropped because .find() took the first needs_human and returned.
// 2. safety text ships verbatim, first -- the merge appends below it, never rewords it.
// 3. every needs_human names its person: Dana is not the right desk for an unauthorised ex.
// WHY: a parent who asked four things and got one answer asks the other three again, worse.

const BATCH_LLM: LlmClient = {
  name: 'fake',
  converse: async (request) => {
    const sawTools = request.turns.some((turn) => turn.role === 'tool')
    if (sawTools) {
      // The loop must end on the routed batch; a second turn means it talked past a hand-off.
      return { text: 'Should never be asked.', toolCalls: [], citedSource: null }
    }
    return {
      text: '',
      citedSource: null,
      toolCalls: [
        { name: 'check_attendance', args: { hoursSinceVomiting: 12 } },
        { name: 'get_center_facts', args: { topic: 'hours', programId: 'toddler' } },
        { name: 'escalate_to_person', args: { topic: 'unsafe_pickup' } },
      ],
    }
  },
}

async function run() {
  return answerQuestion(
    {
      text: 'Mira threw up last night, what are toddler hours, and my ex showed up at pickup.',
      askedAt: '2026-08-25T16:00:00Z',
    },
    { llm: BATCH_LLM, approved: [] },
  )
}

describe('a hand-off keeps the rest of the batch', () => {
  it('still hands off, with the safety verdict first', async () => {
    const result = await run()

    expect(result.outcome).toBe('sent_to_person')
    expect(result.handedOff).toBe(true)
    expect(result.message.toLowerCase()).toContain('staying home')
  })

  it('keeps the answered fact from the same batch, as a bullet', async () => {
    // Code builds this message, so code carries the formatting rule the prompt cannot reach.
    const result = await run()

    expect(result.message.toLowerCase()).toContain('toddler')
    expect(result.message).toMatch(/On your other questions:\n\n- /)
  })

  it('names every person routed to, not just the first', async () => {
    const result = await run()

    expect(result.message).toContain('Dana')
    expect(result.message).toContain('Rosa')
    expect(result.routeTo).toContain('Dana')
    expect(result.routeTo).toContain('Rosa')
  })

  it('does not let the model speak after the routed batch', async () => {
    const result = await run()

    expect(result.message).not.toContain('Should never be asked.')
  })
})

// The same drop, across turns: a tool answers in turn one, the model escalates in turn two.
// FLOW: turn 1 answers -> turn 2 hands off -> the kept answer still reaches the parent
// WHY: "any late fees?" fetched the $15 policy, then escalated, and the parent saw neither.
const CROSS_TURN_LLM: LlmClient = {
  name: 'fake',
  converse: async (request) => {
    const sawTools = request.turns.some((turn) => turn.role === 'tool')
    if (!sawTools) {
      return {
        text: '',
        citedSource: null,
        toolCalls: [{ name: 'get_center_facts', args: { topic: 'hours', programId: 'toddler' } }],
      }
    }
    return {
      text: '',
      citedSource: null,
      toolCalls: [{ name: 'escalate_to_person', args: { topic: 'billing_dispute' } }],
    }
  },
}

describe('a hand-off keeps answers from earlier turns too', () => {
  it('carries the turn-one fact under the turn-two hand-off', async () => {
    const result = await answerQuestion(
      { text: 'toddler hours, and I want to complain about my bill', askedAt: '2026-08-25T16:00:00Z' },
      { llm: CROSS_TURN_LLM, approved: [] },
    )

    expect(result.outcome).toBe('sent_to_person')
    expect(result.message.toLowerCase()).toContain('toddler')
  })
})

// A booking made in a turn that ends as a hand-off must still be written.
// FLOW: book_tour says book -> check_attendance routes -> hand-off wins the outcome ->
//       the "Booked" text survives via the merge -> bookingMade must survive with it
// WHY: real failure, 2026-08-25 — the parent read "Booked: the 13:30 tour" and no row landed.
const BOOK_PLUS_HANDOFF_LLM: LlmClient = {
  name: 'fake',
  converse: async () => ({
    text: '',
    citedSource: null,
    toolCalls: [
      { name: 'book_tour', args: { date: '2026-09-01', time: '13:30' } },
      { name: 'check_attendance', args: { hoursSinceVomiting: 12 } },
    ],
  }),
}

describe('a booking survives a hand-off ending', () => {
  it('carries bookingMade on the routed result', async () => {
    const result = await answerQuestion(
      { text: 'she vomited last night, and book the 1:30 Tuesday tour', askedAt: '2026-08-25T16:00:00Z' },
      { llm: BOOK_PLUS_HANDOFF_LLM, approved: [], bookings: [] },
    )

    expect(result.outcome).toBe('sent_to_person')
    expect(result.message).toContain('Booked')
    expect(result.bookingMade).toEqual({ date: '2026-09-01', time: '13:30' })
  })
})
