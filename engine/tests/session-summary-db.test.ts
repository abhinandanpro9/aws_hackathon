import { describe, expect, it } from 'vitest'
import { memoryDb } from '../src/server/memory-db.js'
import { getSessionSummary, saveSessionSummary } from '../src/server/db.js'

// The rolling summary lives beside the session, so it is written once per overflow.
// FLOW: overflow -> summarise -> save (summary, turns covered) -> next message reads it back

describe('session summaries persist', () => {
  it('round-trips a summary with its covered-turn count', async () => {
    const db = memoryDb()
    await saveSessionSummary(db, 's1', 'Parent asked about Mondays.', 4)

    const stored = await getSessionSummary(db, 's1')
    expect(stored?.summary).toBe('Parent asked about Mondays.')
    expect(stored?.turnsCovered).toBe(4)
  })

  it('a later save wins', async () => {
    const db = memoryDb()
    await saveSessionSummary(db, 's1', 'v1', 2)
    await saveSessionSummary(db, 's1', 'v2', 6)

    const stored = await getSessionSummary(db, 's1')
    expect(stored?.summary).toBe('v2')
    expect(stored?.turnsCovered).toBe(6)
  })

  it('returns null for a session with no summary yet', async () => {
    const db = memoryDb()
    expect(await getSessionSummary(db, 'nobody')).toBeNull()
  })
})
