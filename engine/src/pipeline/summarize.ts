import { SUMMARISE_SYSTEM } from '../prompts/summarize.js'
import type { HistoryTurn } from '../types/answer.js'
import type { LlmClient } from '../types/llm.js'

// The rolling conversation summary: model-written, bounded, stored per session.
// FLOW: prior summary + newly overflowed turns -> one summariser call -> new summary
// 1. incremental: only the turns that just left the verbatim window are summarised
// 2. bounded by the word limit, so a summary never grows with the conversation
// 3. it is context, never a source -- the pipeline labels it "cite none of it"

export interface SummariseInput {
  readonly priorSummary: string | null
  readonly turns: readonly HistoryTurn[]
}

/** Fold newly overflowed turns into the rolling summary. Falls back to the prior on failure. */
export async function summariseHistory(llm: LlmClient, input: SummariseInput): Promise<string> {
  const prior = input.priorSummary?.trim() ?? ''
  const turnsText = input.turns
    .map((turn) => `${turn.role === 'parent' ? 'Parent' : 'Desk'}: ${turn.text}`)
    .join('\n')

  try {
    const reply = await llm.converse({
      system: SUMMARISE_SYSTEM,
      turns: [
        {
          role: 'parent',
          text: `Current summary:\n${prior.length > 0 ? prior : '(none yet)'}\n\nNew turns to fold in:\n${turnsText}`,
        },
      ],
      tools: [],
      temperature: 0,
    })
    const text = reply.text.trim()
    return text.length > 0 ? text : prior
  } catch {
    // A summary that fails to update is stale context, not a broken answer.
    return prior
  }
}
