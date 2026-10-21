import { describe, expect, it } from 'vitest'
import { summariseHistory } from '../src/pipeline/summarize.js'
import { answerQuestion } from '../src/pipeline/answer.js'
import type { ConverseRequest, LlmClient } from '../src/types/llm.js'

// A long conversation carries a MODEL-written rolling summary, stored per session.
// FLOW: turns overflow -> summariser prompt folds them into the prior summary -> stored ->
//       the next answer carries one short summary turn instead of a growing line list
// 1. summarised once per overflow and persisted, never rebuilt from scratch each message
// 2. the summary is bounded by the prompt's word limit, so tokens stay flat forever
// 3. the pipeline treats it as system text to cite from never -- facts still come from tools

function capturing(reply: string, seen: ConverseRequest[]): LlmClient {
  return {
    name: 'fake',
    converse: async (request) => {
      seen.push(request)
      return { text: reply, toolCalls: [], citedSource: null }
    },
  }
}

describe('the summariser call', () => {
  it('asks for a compressed summary of prior summary + overflowed turns', async () => {
    const seen: ConverseRequest[] = []
    const result = await summariseHistory(capturing('Parent asked about Mondays; open Mon-Fri.', seen), {
      priorSummary: 'Parent introduced Mira.',
      turns: [
        { role: 'parent', text: 'are you open on Mondays?' },
        { role: 'assistant', text: 'We are open Monday to Friday.' },
      ],
    })

    expect(result).toBe('Parent asked about Mondays; open Mon-Fri.')
    const sent = (seen[0]?.system ?? '') + seen[0]?.turns.map((t) => t.text).join('\n')
    expect(sent.toLowerCase()).toContain('summar')
    expect(sent).toContain('Parent introduced Mira.')
    expect(sent).toContain('are you open on Mondays?')
  })

  it('falls back to the prior summary when the model returns nothing', async () => {
    const seen: ConverseRequest[] = []
    const result = await summariseHistory(capturing('', seen), {
      priorSummary: 'Prior facts.',
      turns: [{ role: 'parent', text: 'q' }],
    })
    expect(result).toBe('Prior facts.')
  })
})

describe('the pipeline uses a provided summary verbatim', () => {
  it('sends one summary turn instead of building lines', async () => {
    const seen: ConverseRequest[] = []
    await answerQuestion(
      {
        text: 'hi',
        askedAt: '2026-08-25T16:00:00Z',
        history: [{ role: 'parent', text: 'recent q' }, { role: 'assistant', text: 'recent a' }],
        summary: 'Earlier the parent asked about Mondays and lunch.',
      },
      { llm: capturing('Hello!', seen), approved: [] },
    )

    const all = seen[0]?.turns.map((t) => t.text).join('\n') ?? ''
    expect(all).toContain('Earlier the parent asked about Mondays and lunch.')
    expect(all).toContain('cite none of it')
  })
})
