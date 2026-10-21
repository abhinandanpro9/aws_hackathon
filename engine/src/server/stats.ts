import type { ConversationRecord } from './store.js'

// The count behind the dashboard's "time saved" stat.
// FLOW: conversations -> answered AND asked within 7 days of now -> a count
// 1. only answered counts: a hand-off still took a person's time
// 2. "now" is passed in, so the boundary is testable and never reads the clock here

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function answeredThisWeek(records: readonly ConversationRecord[], nowIso: string): number {
  const now = Date.parse(nowIso)
  return records.filter((record) => {
    if (record.outcome !== 'answered') return false
    const asked = Date.parse(record.askedAt)
    return Number.isFinite(asked) && now - asked <= WEEK_MS && asked <= now
  }).length
}
