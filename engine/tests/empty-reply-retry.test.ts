import { describe, expect, it } from 'vitest'
import { answerQuestion } from '../src/pipeline/answer.js'
import type { LlmClient } from '../src/types/llm.js'

// An empty model reply gets one more chance before a person does.
// FLOW: empty reply -> nudge turn -> model retries -> answer, or hand off when turns run out
// 1. real failure, 2026-08-25: "any late fees?" retrieved the right policy twice, then the
//    model returned nothing and the parent was handed off for no reason a parent could see
// 2. bad args already earn a retry inside the loop; an empty reply is the same class of slip
// 3. still bounded by MAX_MODEL_TURNS, so a model that stays silent still reaches a person

function flakyLlm(): LlmClient {
  let call = 0
  return {
    name: 'fake',
    converse: async () => {
      call += 1
      if (call === 1) {
        return {
          text: '',
          citedSource: null,
          toolCalls: [{ name: 'get_center_facts', args: { topic: 'hours', programId: 'toddler' } }],
        }
      }
      if (call === 2) return { text: '', toolCalls: [], citedSource: null }
      return {
        text: '{"answer": "The Toddler Room runs 7:30am to 5:30pm.", "sources": ["center:hours"]}'
          .length > 0
          ? 'The Toddler Room runs 7:30am to 5:30pm.'
          : '',
        toolCalls: [],
        citedSource: 'center:hours',
      }
    },
  }
}

describe('an empty reply is retried, not surrendered', () => {
  it('answers after a nudge instead of handing off', async () => {
    const result = await answerQuestion(
      { text: 'toddler hours?', askedAt: '2026-08-25T16:00:00Z' },
      { llm: flakyLlm(), approved: [] },
    )

    expect(result.outcome).toBe('answered')
    expect(result.message).toContain('7:30am')
    expect(result.trace.some((line) => line.includes('empty'))).toBe(true)
  })

  it('still hands off when the model never speaks', async () => {
    const silent: LlmClient = {
      name: 'fake',
      converse: async () => ({ text: '', toolCalls: [], citedSource: null }),
    }
    const result = await answerQuestion(
      { text: 'toddler hours?', askedAt: '2026-08-25T16:00:00Z' },
      { llm: silent, approved: [] },
    )

    expect(result.outcome).toBe('sent_to_person')
  })
})
