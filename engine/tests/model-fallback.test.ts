import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeminiClient, resetModelState } from '../src/llm/gemini.js'
import { parseModelList } from '../src/config/llm.js'

// The free daily limit is per model. One exhausted model must not end every parent's turn.
// FLOW: model 1 -> 429 -> remembered as exhausted -> same request on model 2 -> answer
// real failure, live: gemini-3.6-flash hit 20/day and every question fell back to a phone number

const OK = { candidates: [{ content: { parts: [{ text: '{"answer":"hi","sources":[]}' }] } }] }

function clientWith(models: string[], behaviour: (model: string) => unknown) {
  const seen: string[] = []
  const configs: Record<string, unknown>[] = []
  const client = new GeminiClient('test-key', models)
  const ai = (client as unknown as { ai: { models: { generateContent: unknown } } }).ai
  ai.models.generateContent = vi.fn(async (request: { model: string; config: Record<string, unknown> }) => {
    seen.push(request.model)
    configs.push(request.config)
    return behaviour(request.model)
  })
  return { client, seen, configs }
}

const quota = Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), { status: 429 })

describe('model fallback chain', () => {
  beforeEach(() => resetModelState())

  it('a 429 on model 1 falls through to model 2, and the answer comes back', async () => {
    const { client, seen } = clientWith(['m-one', 'm-two'], (model) => {
      if (model === 'm-one') throw quota
      return OK
    })

    const reply = await client.converse({ system: 's', turns: [{ role: 'parent', text: 'hi' }], tools: [] })

    expect(seen).toEqual(['m-one', 'm-two'])
    expect(reply.text).toBe('hi')
    expect(client.name).toBe('m-two')
  })

  it('remembers the exhausted model, so the next request skips it', async () => {
    const { client, seen } = clientWith(['m-one', 'm-two'], (model) => {
      if (model === 'm-one') throw quota
      return OK
    })
    await client.converse({ system: 's', turns: [{ role: 'parent', text: 'a' }], tools: [] })
    await client.converse({ system: 's', turns: [{ role: 'parent', text: 'b' }], tools: [] })

    expect(seen).toEqual(['m-one', 'm-two', 'm-two'])
  })

  it('a 503 also moves on', async () => {
    const busy = Object.assign(new Error('UNAVAILABLE'), { status: 503 })
    const { client, seen } = clientWith(['m-one', 'm-two'], (model) => {
      if (model === 'm-one') throw busy
      return OK
    })
    await client.converse({ system: 's', turns: [{ role: 'parent', text: 'a' }], tools: [] })
    expect(seen).toEqual(['m-one', 'm-two'])
  })

  it('a different error is not retried on another model', async () => {
    const bad = Object.assign(new Error('INVALID_ARGUMENT'), { status: 400 })
    const { client, seen } = clientWith(['m-one', 'm-two'], () => {
      throw bad
    })
    await expect(client.converse({ system: 's', turns: [{ role: 'parent', text: 'a' }], tools: [] })).rejects.toThrow()
    expect(seen).toEqual(['m-one'])
  })

  it('the forced first tool survives the fall-through', async () => {
    const { client, configs } = clientWith(['m-one', 'm-two'], (model) => {
      if (model === 'm-one') throw quota
      return OK
    })
    await client.converse({
      system: 's',
      turns: [{ role: 'parent', text: 'fever' }],
      tools: [{ name: 'check_attendance', description: 'd', parameters: { type: 'object', properties: {} } }],
      forceTool: 'check_attendance',
    })
    expect(configs[1]?.['toolConfig']).toEqual({
      functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['check_attendance'] },
    })
  })

  it('reads the list from env, with lite first by default', () => {
    expect(parseModelList(undefined)[0]).toBe('gemini-3.5-flash-lite')
    expect(parseModelList(' a , b ,')).toEqual(['a', 'b'])
  })
})

describe('an exhausted model comes back after its wait', () => {
  beforeEach(() => resetModelState())

  it('a per-minute 429 skips the model only until the retry time Gemini gave', async () => {
    vi.useFakeTimers()
    try {
      const perMinute = Object.assign(new Error('{"error":{"code":429,"message":"Please retry in 30.5s."}}'), { status: 429 })
      let failOnce = true
      const { client, seen } = clientWith(['m-one', 'm-two'], (model) => {
        if (model === 'm-one' && failOnce) {
          failOnce = false
          throw perMinute
        }
        return OK
      })
      await client.converse({ system: 's', turns: [{ role: 'parent', text: 'a' }], tools: [] })
      await client.converse({ system: 's', turns: [{ role: 'parent', text: 'b' }], tools: [] })
      vi.advanceTimersByTime(31_000)
      await client.converse({ system: 's', turns: [{ role: 'parent', text: 'c' }], tools: [] })

      expect(seen).toEqual(['m-one', 'm-two', 'm-two', 'm-one'])
    } finally {
      vi.useRealTimers()
    }
  })
})
