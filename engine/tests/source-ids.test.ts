import { describe, expect, it } from 'vitest'
import { isKnownSource } from '../src/tools/registry.js'

// A source id is either one this system hands out, or it is invented.
// FLOW: cited id -> is it a real centre block, a real criterion, or a real policy@version?
// 1. this used to accept ANY string starting with "center:" or "rule:", so "center:pricing"
//    and "rule:attendance:invented" both validated
// 2. the pipeline also checks the id was handed out THIS message, which narrowed the damage.
//    But this function is exported and is the thing named "isKnownSource" -- its own answer
//    should be true only for ids that exist
// 3. policies are already checked properly, against id and version

const REAL = [
  'center:hours',
  'center:closures',
  'center:tours',
  'center:today',
  'rule:attendance:fever',
  'rule:attendance:vomiting',
]

const INVENTED = [
  'center:pricing',
  'center:staffing',
  'center:',
  'rule:attendance:invented',
  'rule:anything-at-all',
  'rule:',
  'center:hours:extra',
]

describe('a source id is real or it is invented', () => {
  for (const id of REAL) {
    it(`accepts ${id}`, () => {
      expect(isKnownSource(id, [])).toBe(true)
    })
  }

  for (const id of INVENTED) {
    it(`rejects ${id}`, () => {
      expect(isKnownSource(id, [])).toBe(false)
    })
  }

  it('still checks a policy against its exact version', () => {
    const policy = {
      id: 'p1',
      version: 2,
      text: 't',
      labels: [],
      sensitive: false,
      ownerId: null,
      reference: 'r',
      notes: '',
      approvedBy: 'a',
      approvedAt: '2026-01-01',
    }

    expect(isKnownSource('p1@2', [policy])).toBe(true)
    // An edit bumps the version, so the older citation stops validating.
    expect(isKnownSource('p1@1', [policy])).toBe(false)
    expect(isKnownSource('p2@2', [policy])).toBe(false)
  })
})
