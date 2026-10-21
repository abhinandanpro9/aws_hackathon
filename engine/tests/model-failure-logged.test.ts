import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerQuestion } from '../src/pipeline/answer.js'
import type { LlmClient } from '../src/types/llm.js'

// A swallowed cause is an outage you cannot name.
// FLOW: converse throws -> catch logs the cause -> parent still gets a person, not a stack trace
// 1. bad key, quota, 500 and timeout all reach the parent as one sentence, by design
// 2. the operator side must keep the difference: without it every failure looks identical
// 3. `catch {}` discarded the error object at the one moment it existed

const BOOM = new Error('gemini 429: quota exceeded')

const failing: LlmClient = {
  name: 'fake',
  converse: async () => {
    throw BOOM
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a model failure is written down', () => {
  it('logs the cause instead of discarding it', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    await answerQuestion({ text: 'what are your hours?', askedAt: '2026-08-25T16:00:00Z' }, { llm: failing, approved: [] })

    const logged = errors.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain('quota exceeded')
  })

  it('still hands the parent to a person', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await answerQuestion(
      { text: 'what are your hours?', askedAt: '2026-08-25T16:00:00Z' },
      { llm: failing, approved: [] },
    )

    expect(result.outcome).toBe('sent_to_person')
  })
})
