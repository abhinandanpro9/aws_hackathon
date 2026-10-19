import { describe, expect, it } from 'vitest'
import { checkAttendanceTool } from '../src/tools/check-attendance.js'
import { getDeclarations, isKnownSource, runTool } from '../src/tools/registry.js'
import { FRONT_DESK_CAN_TAKE_ACTIONS } from '../src/config/policy.js'
import type { Policy } from '../src/types/knowledge.js'

// The airlock between a model and the rules it may reach.
// FLOW: declarations -> model picks a name + args -> runTool -> that tool's rule -> result
// 1. the model chooses and fills; the tool decides. That split is the safety design.
// 2. malformed args never throw and never default to a permissive answer
// 3. a source id is only real if a tool could have handed it out

const APPROVED: readonly Policy[] = [
  {
    id: 'seed-food',
    version: 1,
    labels: ['food'],
    text: 'Meals are always provided.',
    sensitive: false,
    ownerId: null,
    reference: 'Family Handbook, food',
    notes: '',
    approvedBy: 'Rosa Delgado',
    approvedAt: '2026-08-12T10:00:00.000Z',
  },
]

describe('the declarations a model reads', () => {
  it('offers exactly five tools: rule, knowledge, facts, one gated action, hand-off', () => {
    // The five static-fact tools fold into one faceted lookup; book_tour is the one action,
    // and its gate lives in its own code.
    const names = getDeclarations(APPROVED).map((d) => d.name)
    expect([...names].sort()).toEqual([
      'book_tour',
      'check_attendance',
      'escalate_to_person',
      'get_center_facts',
      'lookup_policy',
    ])
  })

  it('still runs an inner facts topic by name', () => {
    const result = runTool('get_center_facts', { topic: 'hours', programId: 'toddler' }, APPROVED)
    expect(result.tool).toBe('get_center_facts')
    expect(result.outcome).toBe('answered')
  })

  it('treats an unknown facts topic as missing detail, never a guess', () => {
    const result = runTool('get_center_facts', { topic: 'ratios' }, APPROVED)
    expect(result.outcome).toBe('needs_detail')
  })

  it('treats a missing topic as missing detail', () => {
    const result = runTool('get_center_facts', {}, APPROVED)
    expect(result.outcome).toBe('needs_detail')
  })

  it('treats a non-string topic as missing detail', () => {
    const result = runTool('get_center_facts', { topic: 7 }, APPROVED)
    expect(result.outcome).toBe('needs_detail')
  })

  it('is not fooled by a prototype key as a topic', () => {
    // A Record lookup with "constructor" returns a function, not a tool. That must not run.
    for (const hostile of ['constructor', '__proto__', 'toString']) {
      const result = runTool('get_center_facts', { topic: hostile }, APPROVED)
      expect(result.outcome).toBe('needs_detail')
    }
  })

  it('describes each tool in words a model can route on', () => {
    for (const declaration of getDeclarations(APPROVED)) {
      expect(declaration.description.length).toBeGreaterThan(40)
    }
  })
})

describe('dispatch', () => {
  it('runs the tool the model named', () => {
    const result = runTool('check_attendance', { temperatureF: 101.5 }, APPROVED)
    expect(result.tool).toBe('check_attendance')
    expect(result.outcome).toBe('needs_human')
  })

  it('passes the approved list to the one tool that needs it', () => {
    const result = runTool('lookup_policy', { label: 'food' }, APPROVED)
    expect(result.sourceId).toBe('seed-food@1')
  })

  it('returns a safe result for a tool that does not exist', () => {
    // @ts-expect-error deliberately calling a name outside ToolName
    const result = runTool('open_the_gates', {}, APPROVED)
    expect(result.outcome).toBe('needs_human')
    expect(result.routeTo).not.toBeNull()
  })
})

describe('a tool never throws, whatever the model sends', () => {
  const nonsense: readonly Record<string, unknown>[] = [
    { temperatureF: null },
    { temperatureF: [] },
    { temperatureF: {} },
    { unknownField: 'ignored' },
    {},
  ]

  it('degrades to a value for every shape of bad input', () => {
    for (const args of nonsense) {
      expect(() => runTool('check_attendance', args, APPROVED)).not.toThrow()
    }
  })

  it('ignores fields it does not know rather than failing', () => {
    const result = checkAttendanceTool.execute({ temperatureF: 101.5, notAField: true })
    expect(result.outcome).toBe('needs_human')
  })

  it('rejects a negative hours value', () => {
    const result = checkAttendanceTool.execute({ hoursSinceVomiting: -3 })
    expect(result.outcome).toBe('invalid_arguments')
  })

  it('treats a mentioned but unreadable temperature as needing a person', () => {
    const result = checkAttendanceTool.execute({ temperatureUnknown: true })
    expect(result.outcome).toBe('needs_human')
  })
})

describe('a cited source must be one a tool could have handed out', () => {
  it('accepts an approved policy at the version that is live', () => {
    expect(isKnownSource('seed-food@1', APPROVED)).toBe(true)
  })

  it('refuses an approved policy at a version that was replaced', () => {
    expect(isKnownSource('seed-food@0', APPROVED)).toBe(false)
  })

  it('accepts a block of center data', () => {
    expect(isKnownSource('center:hours', APPROVED)).toBe(true)
  })

  it('accepts a rule verdict', () => {
    expect(isKnownSource('rule:attendance:fever', APPROVED)).toBe(true)
  })

  it('rejects a policy id that was never approved', () => {
    expect(isKnownSource('seed-invented@1', APPROVED)).toBe(false)
  })

  it('rejects a source the model made up entirely', () => {
    expect(isKnownSource('the handbook, page 4', APPROVED)).toBe(false)
  })
})

// The tool descriptions ARE the model's instructions, so a stale one overrides the flag.
// FLOW: FRONT_DESK_CAN_TAKE_ACTIONS -> book_tour writes -> get_center_facts must not still say "we cannot book"
// 1. the refusal in every code path is gated on the flag; this string was not
// 2. left as-is the model read "we cannot book, so say so" and refused a booking it could make
describe('tool descriptions match the action gate', () => {
  it('does not tell the model booking is impossible while the gate is open', () => {
    const facts = getDeclarations(APPROVED).find((d) => d.name === 'get_center_facts')
    expect(FRONT_DESK_CAN_TAKE_ACTIONS).toBe(true)
    expect(facts?.description).not.toMatch(/cannot book/i)
  })
})
