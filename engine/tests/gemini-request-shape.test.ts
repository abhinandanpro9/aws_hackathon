import { describe, expect, it, vi } from 'vitest'
import { GeminiClient } from '../src/llm/gemini.js'

// Gemini 3.6+ REJECTS the sampling params 3.5 took, and fails before reading the prompt.
// FLOW: generateContent(config) -> validation -> 400 with zero tokens -> "model was unreachable"
// 1. temperature/top_p/top_k were dropped: sending one invalidates the whole request
// 2. thinkingBudget was replaced by thinkingLevel ('low' | 'medium' | 'high')
// 3. the symptom is silent -- inputTokens 0, outputTokens 0, ~1.5s, no partial answer

function captureConfig(): { calls: Record<string, unknown>[]; client: GeminiClient } {
  const calls: Record<string, unknown>[] = []
  // Pinned to 3.6: thinkingLevel is a 3.6+ setting, and the default list now starts on lite.
  const client = new GeminiClient('test-key', ['gemini-3.6-flash'])

  const ai = (client as unknown as { ai: { models: { generateContent: unknown } } }).ai
  ai.models.generateContent = vi.fn(async (request: { config: Record<string, unknown> }) => {
    calls.push(request.config)
    return { candidates: [{ content: { parts: [{ text: '{"answer":"hi","sources":[]}' }] } }] }
  })

  return { calls, client }
}

describe('the request Gemini 3.7 will actually accept', () => {
  it('sends no deprecated sampling parameters', async () => {
    const { calls, client } = captureConfig()

    await client.converse({ system: 'be brief', turns: [{ role: 'parent', text: 'hi' }], tools: [] })

    expect(calls).toHaveLength(1)
    expect(calls[0]).not.toHaveProperty('temperature')
    expect(calls[0]).not.toHaveProperty('topP')
    expect(calls[0]).not.toHaveProperty('topK')
  })

  it('asks for a thinking level, not a token budget', async () => {
    const { calls, client } = captureConfig()

    await client.converse({ system: 'be brief', turns: [{ role: 'parent', text: 'hi' }], tools: [] })

    const thinking = calls[0]?.['thinkingConfig'] as Record<string, unknown> | undefined
    expect(thinking?.['thinkingBudget']).toBeUndefined()
    expect(thinking?.['thinkingLevel']).toBe('LOW')
  })
})

// Quill and the handbook extract ask for their own JSON array. The answer/sources wrapper
// used to override that and keep only "answer", so every draft parsed to nothing.
describe('raw format, for callers that ask for their own JSON', () => {
  it('sends the system prompt as is and returns the reply text untouched', async () => {
    const calls: Record<string, unknown>[] = []
    const client = new GeminiClient('test-key')
    const ai = (client as unknown as { ai: { models: { generateContent: unknown } } }).ai
    const draft = '[{"text":"We do not offer swimming.","labels":["swimming"],"sensitive":false,"reference":"r"}]'
    ai.models.generateContent = vi.fn(async (request: { config: Record<string, unknown> }) => {
      calls.push(request.config)
      return { candidates: [{ content: { parts: [{ text: draft }] } }] }
    })

    const reply = await client.converse({
      system: 'draft one policy',
      turns: [{ role: 'parent', text: 'swimming?' }],
      tools: [],
      format: 'raw',
    })

    expect(calls[0]?.['systemInstruction']).toBe('draft one policy')
    expect(reply.text).toBe(draft)
  })
})
