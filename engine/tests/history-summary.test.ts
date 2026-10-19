import { describe, expect, it } from 'vitest'
import { answerQuestion } from '../src/pipeline/answer.js'
import type { ConverseRequest, LlmClient } from '../src/types/llm.js'
import type { HistoryTurn } from '../src/types/answer.js'

// A long conversation is summarised, never silently truncated.
// FLOW: older turns -> one compact code-built summary turn -> recent turns verbatim
// 1. built by code from the turns themselves: no extra model call, nothing invented
// 2. the model can still resolve "the thing I asked at the start"
// 3. short conversations are untouched -- no summary turn until the window overflows

function longHistory(exchanges: number): HistoryTurn[] {
  const turns: HistoryTurn[] = []
  for (let i = 1; i <= exchanges; i += 1) {
    turns.push({ role: 'parent', text: `question number ${i}` })
    turns.push({ role: 'assistant', text: `answer number ${i}` })
  }
  return turns
}

function capturingLlm(seen: ConverseRequest[]): LlmClient {
  return {
    name: 'fake',
    converse: async (request) => {
      seen.push(request)
      return { text: 'Hello!', toolCalls: [], citedSource: null }
    },
  }
}

describe('history beyond the window is summarised', () => {
  it('keeps the earliest question reachable through a summary turn', async () => {
    const seen: ConverseRequest[] = []
    await answerQuestion(
      { text: 'hi', askedAt: '2026-08-25T16:00:00Z', history: longHistory(10) },
      { llm: capturingLlm(seen), approved: [] },
    )

    const all = seen[0]?.turns.map((turn) => turn.text).join('\n') ?? ''
    expect(all).toContain('question number 1')
    expect(all).toContain('question number 10')
  })

  it('marks the summary as a summary, not as words anyone said', async () => {
    const seen: ConverseRequest[] = []
    await answerQuestion(
      { text: 'hi', askedAt: '2026-08-25T16:00:00Z', history: longHistory(10) },
      { llm: capturingLlm(seen), approved: [] },
    )

    expect(seen[0]?.turns.some((turn) => turn.text.includes('Earlier in this conversation'))).toBe(true)
  })

  it('adds no summary turn while the window still fits', async () => {
    const seen: ConverseRequest[] = []
    await answerQuestion(
      { text: 'hi', askedAt: '2026-08-25T16:00:00Z', history: longHistory(3) },
      { llm: capturingLlm(seen), approved: [] },
    )

    expect(seen[0]?.turns.some((turn) => turn.text.includes('Earlier in this conversation'))).toBe(false)
  })
})
