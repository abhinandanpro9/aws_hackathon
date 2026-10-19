import { describe, expect, it } from 'vitest'
import centerData from '../data/center.json' with { type: 'json' }
import { seedPolicies } from '../src/server/store.js'
import type { Policy } from '../src/types/knowledge.js'

// Every policy has the same fields, whatever it is about.
// FLOW: center.json policies -> seedPolicies -> the one shape the whole engine reads
// 1. a per-topic shape meant code had to know which field held the sentence. It no longer does.
// 2. reference is shown to a parent; notes never leave the control panel
// 3. sensitive lives on the record, so the refusal rule reads data rather than a hardcoded list

const FIELDS = [
  'id',
  'version',
  'text',
  'labels',
  'sensitive',
  'ownerId',
  'reference',
  'notes',
  'approvedBy',
  'approvedAt',
] as const

describe('one shape, every policy', () => {
  const policies: readonly Policy[] = seedPolicies()

  it('seeds every policy the centre has written', () => {
    expect(policies.length).toBe(centerData.policies.length)
  })

  it('gives every policy exactly the same fields', () => {
    for (const policy of policies) {
      expect(Object.keys(policy).sort()).toEqual([...FIELDS].sort())
    }
  })

  it('states the policy itself, with no guessed question in front of it', () => {
    for (const policy of policies) {
      expect(policy.text.length).toBeGreaterThan(20)
    }
  })

  it('gives every policy a unique id', () => {
    const ids = new Set(policies.map((p) => p.id))
    expect(ids.size).toBe(policies.length)
  })

  it('carries a real version on every policy', () => {
    // The seed mirrors live, which edits policies through the approval queue, so a
    // version above 1 is history, not an error. Zero or a fraction would be.
    for (const policy of policies) {
      expect(Number.isInteger(policy.version)).toBe(true)
      expect(policy.version).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('reference and notes are different things', () => {
  const policies = seedPolicies()

  it('gives every policy a reference a parent could check', () => {
    for (const policy of policies) {
      expect(policy.reference.length).toBeGreaterThan(10)
    }
  })

  it('allows notes to be empty, because not every policy needs a remark', () => {
    for (const policy of policies) {
      expect(typeof policy.notes).toBe('string')
    }
  })

  it('never puts the operator note inside the reference', () => {
    for (const policy of policies) {
      if (policy.notes.length === 0) continue
      expect(policy.reference).not.toContain(policy.notes)
    }
  })
})

describe('sensitivity is data on the record', () => {
  const policies = seedPolicies()

  it('marks the medication policy sensitive', () => {
    const medication = policies.find((p) => p.labels.includes('medication'))
    expect(medication?.sensitive).toBe(true)
  })

  it('names an owner for a sensitive policy, so it can be routed', () => {
    for (const policy of policies) {
      if (policy.sensitive) expect(policy.ownerId).not.toBeNull()
    }
  })

  it('does not mark an ordinary policy sensitive', () => {
    const food = policies.find((p) => p.labels.includes('food'))
    expect(food?.sensitive).toBe(false)
  })
})

describe('labels replace a single topic', () => {
  const policies = seedPolicies()

  it('gives every policy at least one label', () => {
    for (const policy of policies) expect(policy.labels.length).toBeGreaterThan(0)
  })

  it('lets one policy carry more than one label', () => {
    expect(policies.some((p) => p.labels.length > 1)).toBe(true)
  })
})
