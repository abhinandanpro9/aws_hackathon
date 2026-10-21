import { describe, expect, it } from 'vitest'
import { memoryDb } from '../src/server/memory-db.js'
import { getChanges, seedIfEmpty } from '../src/server/db.js'

// A fresh centre starts with drafts waiting, so the approval queue demos itself.
// FLOW: empty db -> seedIfEmpty -> policies + the handbook draft proposals, pending
// 1. drafts are data in center.json, mirrored from live -- reseeding reproduces live
// 2. pending, never approved: the operator's first act is a real review, not a tour

describe('seeding includes draft proposals', () => {
  it('leaves the handbook drafts waiting for review', async () => {
    const db = memoryDb()
    await seedIfEmpty(db)

    const pending = (await getChanges(db)).filter((c) => c.status === 'pending')
    expect(pending.length).toBeGreaterThanOrEqual(3)
    expect(pending.every((c) => c.kind === 'create')).toBe(true)
  })

  it('does not duplicate drafts on a second seed call', async () => {
    const db = memoryDb()
    await seedIfEmpty(db)
    await seedIfEmpty(db)

    const pending = (await getChanges(db)).filter((c) => c.status === 'pending')
    expect(pending.length).toBeLessThanOrEqual(3)
  })
})
