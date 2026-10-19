import { describe, expect, it } from 'vitest'
import { lookupPolicyTool } from '../src/tools/lookup-policy.js'
import { isKnownSource } from '../src/tools/registry.js'
import type { Policy } from '../src/types/knowledge.js'

// A policy id is not enough on its own, because the text behind it can change.
// FLOW: operator edits -> version moves -> an answer citing the old version is refused
// 1. the id stays stable so history, usage and links keep working across an edit
// 2. the version moves so a cited source pins the exact words that were read
// 3. citing a stale version is refused exactly like citing one that never existed

const policy = (id: string, version: number, text: string): Policy => ({
  id,
  version,
  labels: ['food'],
  text,
  sensitive: false,
  ownerId: null,
  reference: 'Family Handbook, Page 8, MEALS',
  notes: '',
  approvedBy: 'Rosa Delgado',
  approvedAt: '2026-08-12T10:00:00.000Z',
})

const ID = '1ca920bf-979d-41ad-8d67-aa87855ea096'

describe('a cited source pins the version it read', () => {
  it('hands the model the id and the version together', () => {
    const approved = [policy(ID, 1, 'Meals are always provided.')]
    const result = lookupPolicyTool.execute({ label: 'food' }, approved)

    expect(result.sourceId).toBe(`${ID}@1`)
  })

  it('moves the cited source when an operator edits the policy', () => {
    const before = lookupPolicyTool.execute({ label: 'food' }, [policy(ID, 1, 'Meals are provided.')])
    const after = lookupPolicyTool.execute({ label: 'food' }, [policy(ID, 2, 'Meals are provided, and we cater for allergies.')])

    expect(before.sourceId).not.toBe(after.sourceId)
    expect(after.sourceId).toBe(`${ID}@2`)
  })

  it('keeps the id stable across an edit, so links and history still work', () => {
    const after = lookupPolicyTool.execute({ label: 'food' }, [policy(ID, 2, 'Reworded.')])
    expect(after.sourceId).toContain(ID)
  })
})

describe('a stale citation is refused like an invented one', () => {
  const approved = [policy(ID, 2, 'The current wording.')]

  it('accepts the version that is live now', () => {
    expect(isKnownSource(`${ID}@2`, approved)).toBe(true)
  })

  it('refuses the version that was replaced', () => {
    expect(isKnownSource(`${ID}@1`, approved)).toBe(false)
  })

  it('refuses a bare id with no version at all', () => {
    expect(isKnownSource(ID, approved)).toBe(false)
  })

  it('refuses a policy that never existed', () => {
    expect(isKnownSource('00000000-0000-0000-0000-000000000000@1', approved)).toBe(false)
  })
})

describe('structured facts carry a version too', () => {
  it('accepts a centre-data source', () => {
    expect(isKnownSource('center:hours', [])).toBe(true)
  })

  it('accepts a rule verdict', () => {
    expect(isKnownSource('rule:attendance:fever', [])).toBe(true)
  })
})
