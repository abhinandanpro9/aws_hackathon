// Group messages into the sittings they came from.
// FLOW: conversation records (newest first) -> grouped by session -> worst outcome surfaces
// 1. a message with no session id is a thread of one, so nothing is hidden
// 2. the thread shows the outcome that needs ATTENTION, not the most recent one
// 3. pure function over records: it does not care whether they came from D1 or memory

import type { ConversationRecord, ConversationThread } from './store.js'
import type { AnswerResult } from '../types/answer.js'

/** Worst-first, because that is what an operator needs to look at. */
const OUTCOME_SEVERITY: Record<AnswerResult['outcome'], number> = {
  no_answer: 3,
  sent_to_person: 2,
  answered: 1,
}

export function threadsFrom(
  conversations: readonly ConversationRecord[],
): readonly ConversationThread[] {
  const groups = new Map<string, ConversationRecord[]>()

  for (const record of conversations) {
    const key = record.sessionId ?? record.id
    const existing = groups.get(key)
    if (existing === undefined) groups.set(key, [record])
    else existing.push(record)
  }

  const threads: ConversationThread[] = []

  for (const [sessionId, records] of groups) {
    const ordered = [...records].sort((a, b) => a.askedAt.localeCompare(b.askedAt))
    const first = ordered[0]
    if (first === undefined) continue

    const worst = ordered.reduce((acc, r) =>
      OUTCOME_SEVERITY[r.outcome] > OUTCOME_SEVERITY[acc.outcome] ? r : acc,
    )

    threads.push({
      sessionId,
      startedAt: first.askedAt,
      firstQuestion: first.question,
      messageCount: ordered.length,
      outcome: worst.outcome,
      handledBy: worst.handledBy,
      messages: ordered,
    })
  }

  return threads.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}
