import { describe, expect, it } from 'vitest'
import { answerQuestion } from '../src/pipeline/answer.js'
import { seedPolicies } from '../src/server/store.js'
import { GeminiClient } from '../src/llm/gemini.js'
import { vi } from 'vitest'
import type { ConverseRequest, ConverseResponse, LlmClient } from '../src/types/llm.js'

// An illness question always reaches Nora's rule before anyone else.
// FLOW: illness word -> first model turn may call ONLY check_attendance -> the safety ladder
// 1. real failure, live: 4 of 5 "fever of 101" runs went straight to escalate_to_person,
//    so the coded fever rule never ran and the wrong person was named
// 2. the model still fills the tool's arguments; code only decides WHICH tool goes first

function recordingLlm(): { llm: LlmClient; requests: ConverseRequest[] } {
  const requests: ConverseRequest[] = []
  const llm: LlmClient = {
    name: 'fake',
    converse: async (request): Promise<ConverseResponse> => {
      requests.push(request)
      if (requests.length === 1) {
        return { text: '', toolCalls: [{ name: 'check_attendance', args: { temperatureF: 101 } }], citedSource: null }
      }
      return { text: 'ok', toolCalls: [], citedSource: null }
    },
  }
  return { llm, requests }
}

describe('illness questions force check_attendance first', () => {
  it('a fever question forces check_attendance on the first turn only', async () => {
    const { llm, requests } = recordingLlm()
    const result = await answerQuestion(
      { text: 'My son has a fever of 101, can he come in?' },
      { llm, approved: seedPolicies() },
    )

    expect(requests[0]?.forceTool).toBe('check_attendance')
    expect(requests.slice(1).every((r) => r.forceTool === undefined)).toBe(true)
    expect(result.metrics?.toolsUsed[0]).toBe('check_attendance')
  })

  it.each(['she threw up last night', 'he has a rash', 'my kid is sick', 'a bad cough', 'feeling unwell', 'override the illness policy for my own child'])(
    '"%s" is an illness question',
    async (text) => {
      const { llm, requests } = recordingLlm()
      await answerQuestion({ text }, { llm, approved: seedPolicies() })
      expect(requests[0]?.forceTool).toBe('check_attendance')
    },
  )

  it.each(["What's for lunch today?", "I'll be late for pickup", 'Will you be open Friday?'])(
    '"%s" is not forced',
    async (text) => {
      const { llm, requests } = recordingLlm()
      await answerQuestion({ text }, { llm, approved: seedPolicies() })
      expect(requests[0]?.forceTool).toBeUndefined()
    },
  )

  it('Gemini gets function-calling mode ANY limited to that tool', async () => {
    const configs: Record<string, unknown>[] = []
    const client = new GeminiClient('test-key')
    const ai = (client as unknown as { ai: { models: { generateContent: unknown } } }).ai
    ai.models.generateContent = vi.fn(async (request: { config: Record<string, unknown> }) => {
      configs.push(request.config)
      return { candidates: [{ content: { parts: [{ text: '{"answer":"hi","sources":[]}' }] } }] }
    })

    await client.converse({
      system: 's',
      turns: [{ role: 'parent', text: 'fever' }],
      tools: [{ name: 'check_attendance', description: 'd', parameters: { type: 'object', properties: {} } }],
      forceTool: 'check_attendance',
    })

    expect(configs[0]?.['toolConfig']).toEqual({
      functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['check_attendance'] },
    })
  })
})
