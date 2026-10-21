import { describe, expect, it } from 'vitest'
import centerData from '../data/center.json' with { type: 'json' }

// Labels are how a parent's question finds a policy, so a wrong one is a wrong answer.
// FLOW: parent asks -> model picks a label -> lookup_policy returns every policy carrying it
// 1. labels were originally inferred from handbook SECTION HEADINGS rather than the sentence,
//    which put "birthdays" on a policy about cultural traditions and left the real birthday
//    policy unlabelled. A parent asking about cupcakes got a paragraph on family traditions.
// 2. these are cheap structural checks, not a substitute for reading the data

const POLICIES = centerData.policies

describe('seed labels', () => {
  it('gives every policy at least one label', () => {
    // A policy with no label can never be retrieved: it is in the file and unreachable.
    const orphans = POLICIES.filter((p) => p.labels.length === 0).map((p) => p.reference)
    expect(orphans).toEqual([])
  })

  it('never labels a policy "birthdays" unless it mentions birthdays', () => {
    const wrong = POLICIES.filter(
      (p) => p.labels.includes('birthdays') && !p.text.toLowerCase().includes('birthday'),
    ).map((p) => p.reference)

    expect(wrong).toEqual([])
  })

  it('labels every policy that IS about birthdays', () => {
    const missing = POLICIES.filter(
      (p) => p.text.toLowerCase().includes('birthday') && !p.labels.includes('birthdays'),
    ).map((p) => p.reference)

    expect(missing).toEqual([])
  })

  it('carries no label so broad it says nothing', () => {
    // "daily" was on seven policies and meant "happens at the center", which is true of all
    // 45. A label a parent would never ask about cannot route anything.
    const labels = new Set(POLICIES.flatMap((p) => p.labels))
    expect(labels.has('daily')).toBe(false)
  })

  it('uses one name per idea, so a lookup cannot find half the set', () => {
    // nap and rest were used interchangeably across the same four policies.
    const labels = new Set(POLICIES.flatMap((p) => p.labels))
    expect(labels.has('rest')).toBe(false)
    expect(labels.has('nap')).toBe(true)
  })

  it('keeps every label reachable from more than nothing', () => {
    const counts = new Map<string, number>()
    for (const policy of POLICIES) {
      for (const label of policy.labels) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    // Every label must belong to at least one policy. A label on zero policies is a dead end
    // the model can still choose, which reads to a parent as "we have nothing on that".
    expect([...counts.values()].every((n) => n > 0)).toBe(true)
  })
})

describe('the late fee is answerable', () => {
  it('carries the $15.00 late-pickup fee the handbook states at line 1226', () => {
    const feePolicy = POLICIES.find((p) => p.text.includes('$15.00'))
    expect(feePolicy).toBeDefined()
    expect(feePolicy?.labels).toContain('late')
    expect(feePolicy?.labels).toContain('fees')
  })
})
