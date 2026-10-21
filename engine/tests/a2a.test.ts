import { describe, expect, it } from 'vitest'
import { app } from '../src/server/app.js'
import { memoryDb } from '../src/server/memory-db.js'
import { answerQuestion } from '../src/pipeline/answer.js'
import { seedPolicies } from '../src/server/store.js'
import { stepsFromTrace } from '../src/lib/agents.js'
import { getActivity, recordActivity } from '../src/server/db.js'
import type { ConverseResponse, LlmClient } from '../src/types/llm.js'

// The crew speaks A2A (v1.0): every agent has a card and answers JSON-RPC SendMessage.
// FLOW: Ava picks a tool -> SendMessage to the owner (in-process) -> Task with a DataPart -> loop

const env = () => ({ DB: memoryDb() })

function feverLlm(): LlmClient {
  let calls = 0
  return {
    name: 'fake',
    converse: async (): Promise<ConverseResponse> => {
      calls += 1
      if (calls === 1) return { text: '', toolCalls: [{ name: 'check_attendance', args: { temperatureF: 101 } }], citedSource: null }
      return { text: 'ok', toolCalls: [], citedSource: null }
    },
  }
}

describe('A2A agent cards', () => {
  it('Nora publishes a v1.0 card at the well-known path', async () => {
    const res = await app.request('http://x.test/a2a/nora/.well-known/agent-card.json', {}, env())
    const card = (await res.json()) as Record<string, any>
    expect(card['name']).toBe('Nora')
    expect(typeof card['description']).toBe('string')
    expect(typeof card['version']).toBe('string')
    expect(card['supportedInterfaces'][0]).toEqual({ url: 'http://x.test/a2a/nora', protocolBinding: 'JSONRPC', protocolVersion: '1.0' })
    expect(card['capabilities']).toEqual({ streaming: false, pushNotifications: false })
    expect(card['defaultInputModes']).toContain('application/json')
    expect(card['defaultOutputModes']).toContain('text/plain')
    expect(card['skills'][0]).toMatchObject({ id: 'check_attendance', tags: expect.any(Array) })
  })

  it('/a2a lists all six cards', async () => {
    const res = await app.request('http://x.test/a2a', {}, env())
    const body = (await res.json()) as { agents: { name: string }[] }
    expect(body.agents.map((a) => a.name)).toEqual(['Ava', 'Lena', 'Nora', 'Theo', 'Max', 'Quill'])
  })
})

describe('A2A SendMessage', () => {
  it('Nora, given a fever of 101, returns a completed Task with the stay-home verdict', async () => {
    const res = await app.request(
      'http://x.test/a2a/nora',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'SendMessage',
          params: { message: { messageId: 'm1', role: 'ROLE_USER', parts: [{ data: { temperatureF: 101 } }] } },
        }),
      },
      env(),
    )
    const body = (await res.json()) as Record<string, any>
    const task = body['result']['task']
    expect(body['id']).toBe(1)
    expect(task['status']['state']).toBe('TASK_STATE_COMPLETED')
    const parts = task['artifacts'][0]['parts']
    expect(parts.some((p: any) => typeof p.text === 'string')).toBe(true)
    expect(parts.find((p: any) => p.data !== undefined).data.detail.ruleVerdict).toBe('stay_home')
  })

  it('an unknown method is a JSON-RPC -32601 error', async () => {
    const res = await app.request(
      'http://x.test/a2a/nora',
      { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'Nope', params: {} }) },
      env(),
    )
    expect(((await res.json()) as any).error.code).toBe(-32601)
  })
})

describe('Ava delegates over A2A', () => {
  it('a fever run sends SendMessage to Nora and the step carries the taskId', async () => {
    const result = await answerQuestion({ text: 'My son has a fever of 101' }, { llm: feverLlm(), approved: seedPolicies() })
    expect(result.a2a?.[0]).toMatchObject({ agent: 'nora', method: 'SendMessage', taskId: expect.any(String), messageId: expect.any(String) })
    const nora = stepsFromTrace(result).find((s) => s.agent === 'nora')
    expect(nora?.a2a?.taskId).toBe(result.a2a?.[0]?.taskId)
  })

  it('an A2A failure falls back to the direct tool call', async () => {
    const result = await answerQuestion(
      { text: 'My son has a fever of 101' },
      {
        llm: feverLlm(),
        approved: seedPolicies(),
        a2aTransport: () => {
          throw new Error('transport down')
        },
      },
    )
    expect(result.trace.some((l) => l.startsWith('ran check_attendance: needs_human'))).toBe(true)
    expect(result.a2a ?? []).toEqual([])
    expect(result.outcome).toBe('sent_to_person')
  })
})

describe('activity keeps the A2A hop', () => {
  it('stores and returns method, taskId and messageId', async () => {
    const DB = memoryDb()
    const a2a = { method: 'SendMessage', taskId: 'task_1', messageId: 'msg_1' }
    await recordActivity(DB, [{ agent: 'nora', action: 'Checked', tool: 'check_attendance', ms: 1, a2a }], 'q', 'now')
    expect((await getActivity(DB, 5))[0]?.a2a).toEqual(a2a)
  })
})

describe('the hand-off to Max goes over A2A too', () => {
  it('a fever run reads Ava -> Nora -> Max, both hops over A2A, still to Dana', async () => {
    const result = await answerQuestion({ text: 'My son has a fever of 101' }, { llm: feverLlm(), approved: seedPolicies() })
    expect(result.a2a?.map((h) => `${h.agent}:${h.tool}`)).toEqual(['nora:check_attendance', 'max:hand_off'])
    expect(result.routeTo).toContain('Dana')
    const steps = stepsFromTrace(result)
    const max = steps[steps.length - 1]
    expect(max?.agent).toBe('max')
    expect(max?.a2a?.taskId).toBe(result.a2a?.[1]?.taskId)
  })

  it('Max hand_off over A2A names the person it was given', async () => {
    const res = await app.request(
      'http://x.test/a2a/max',
      {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'SendMessage',
          params: { message: { messageId: 'm3', role: 'ROLE_USER', parts: [{ data: { skill: 'hand_off', args: { routeTo: 'Dana Whitfield, Health & Safety Lead', question: 'q' } } }] } },
        }),
      },
      env(),
    )
    const task = ((await res.json()) as any).result.task
    expect(task.artifacts[0].parts[0].text).toContain('Dana Whitfield')
  })
})
