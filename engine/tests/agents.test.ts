import { describe, expect, it, vi } from 'vitest'
import { AGENTS, parseRouteTo, stepsFromTrace } from '../src/lib/agents.js'
import { notifyEscalation } from '../src/lib/notify.js'
import { app } from '../src/server/app.js'
import { memoryDb } from '../src/server/memory-db.js'
import { getActivity, recordActivity } from '../src/server/db.js'

// The crew view reads the same trace the operator log does.
// FLOW: trace lines -> owner per tool -> ava opens, owners act, ava or max closes

describe('agent steps from a tool trace', () => {
  it('a fever question goes ava -> nora -> ava', () => {
    const steps = stepsFromTrace({
      trace: [
        'question received: "My son has a fever of 101"',
        'ran check_attendance: answered (center:illness)',
        'answer accepted, cited center:illness',
      ],
      outcome: 'answered',
      routeTo: null,
      metrics: { latencyMs: 900 },
    })

    expect(steps.map((s) => s.agent)).toEqual(['ava', 'nora', 'ava'])
    expect(steps[0]).toMatchObject({ action: 'Read the question', handoffTo: 'nora', ms: 0 })
    expect(steps[1]).toMatchObject({ tool: 'check_attendance', handoffTo: 'ava' })
    expect(steps[2]).toMatchObject({ action: 'Wrote the answer and checked every source', ms: 900 })
  })

  it('an escalation ends on a max step naming the person', () => {
    const steps = stepsFromTrace({
      trace: ['question received: "custody"', 'ran escalate_to_person: needs_human'],
      outcome: 'sent_to_person',
      routeTo: 'Maria Lopez, Center Director (555-0100 ext. 1)',
    })

    expect(steps.map((s) => s.agent)).toEqual(['ava', 'max', 'max'])
    expect(steps[0]?.handoffTo).toBe('max')
    expect(steps[2]?.action).toContain('Maria Lopez')
  })

  it('a straight answer with no tool is ava twice', () => {
    const steps = stepsFromTrace({ trace: ['question received: "hi"'], outcome: 'answered', routeTo: null })
    expect(steps.map((s) => s.agent)).toEqual(['ava', 'ava'])
    expect(steps[0]?.handoffTo).toBeUndefined()
  })

  it('reads name and role out of a routed person', () => {
    expect(parseRouteTo('Maria Lopez, Center Director (555-0100 ext. 1) · Sam Lee, Nurse (x)')).toEqual({
      person: 'Maria Lopez',
      role: 'Center Director',
    })
  })
})

describe('escalation notice to n8n', () => {
  const payload = {
    event: 'escalation' as const,
    person: 'Maria Lopez',
    role: 'Center Director',
    question: 'q',
    sessionId: null,
    at: '2026-10-19T00:00:00Z',
  }

  it('is skipped without a URL, and reports fallback', async () => {
    const fetchImpl = vi.fn()
    const { notified, pending } = notifyEscalation(undefined, payload, fetchImpl)
    await pending
    expect(notified).toEqual({ channel: 'fallback', to: 'Maria Lopez (Center Director)' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never throws when the webhook fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'))
    const { notified, pending } = notifyEscalation('https://n8n.example/hook', payload, fetchImpl)
    await expect(pending).resolves.toBeUndefined()
    expect(notified.channel).toBe('n8n')
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ event: 'escalation', person: 'Maria Lopez' })
  })

  it('never throws when fetch itself throws synchronously', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('boom')
    })
    const { notified, pending } = notifyEscalation('https://n8n.example/hook', payload, fetchImpl)
    await pending
    expect(notified.channel).toBe('fallback')
  })
})

describe('crew routes', () => {
  it('/api/agents lists all six with id, name, role, tool, color', async () => {
    const res = await app.request('/api/agents', {}, { DB: memoryDb() })
    const body = (await res.json()) as { agents: typeof AGENTS }
    expect(body.agents.map((a) => a.id)).toEqual(['ava', 'lena', 'nora', 'theo', 'max', 'quill'])
    for (const agent of body.agents) {
      expect(Object.keys(agent).sort()).toEqual(['color', 'id', 'name', 'role', 'tool'])
    }
  })

  it('/api/sponsors defaults to FALLBACK, n8n REAL only with a URL', async () => {
    const off = await app.request('/api/sponsors', {}, { DB: memoryDb() })
    expect(await off.json()).toEqual({
      sponsors: {
        n8n: { mode: 'FALLBACK' },
        rocketride: { mode: 'FALLBACK' },
        masky: { mode: 'FALLBACK' },
        prelint: { mode: 'FALLBACK' },
      },
    })

    const on = await app.request('/api/sponsors', {}, {
      DB: memoryDb(),
      N8N_WEBHOOK_URL: 'https://n8n.example/hook',
      SPONSOR_PRELINT: 'REAL',
      SPONSOR_MASKY: 'cached',
    })
    const body = (await on.json()) as { sponsors: Record<string, { mode: string }> }
    expect(body.sponsors['n8n']?.mode).toBe('REAL')
    expect(body.sponsors['prelint']?.mode).toBe('REAL')
    expect(body.sponsors['snyk']).toBeUndefined()
    expect(body.sponsors['masky']?.mode).toBe('CACHED')
  })

  it('/api/activity returns stored steps newest first', async () => {
    const DB = memoryDb()
    await recordActivity(DB, [{ agent: 'ava', action: 'Read the question', ms: 0 }], 'first', '2026-10-19T00:00:00Z')
    await new Promise((r) => setTimeout(r, 2))
    await recordActivity(DB, [{ agent: 'nora', action: 'Checked', tool: 'check_attendance', ms: 5 }], 'second', '2026-10-19T00:00:01Z')

    expect((await getActivity(DB, 1)).map((e) => e.question)).toEqual(['second'])
    const res = await app.request('/api/activity?limit=50', {}, { DB })
    const body = (await res.json()) as { activity: { question: string; agent: string; tool?: string }[] }
    expect(body.activity.map((e) => e.question)).toEqual(['second', 'first'])
    expect(body.activity[0]).toMatchObject({ agent: 'nora', tool: 'check_attendance' })
  })
})

describe('activity order', () => {
  it('keeps one question in step order, with newer questions first', async () => {
    const DB = memoryDb()
    await recordActivity(
      DB,
      [
        { agent: 'ava', action: 'Read the question', handoffTo: 'lena', ms: 0 },
        { agent: 'lena', action: 'Looked up', tool: 'lookup_policy', ms: 5 },
        { agent: 'ava', action: 'Wrote the answer', ms: 9 },
      ],
      'older',
      '2026-10-19T00:00:00Z',
    )
    await new Promise((r) => setTimeout(r, 2))
    await recordActivity(
      DB,
      [
        { agent: 'ava', action: 'Read the question', handoffTo: 'nora', ms: 0 },
        { agent: 'nora', action: 'Checked', tool: 'check_attendance', ms: 5 },
        { agent: 'max', action: 'Passed it on', ms: 9 },
      ],
      'newer',
      '2026-10-19T00:00:01Z',
    )

    const events = await getActivity(DB, 50)
    expect(events.map((e) => `${e.question}:${e.agent}`)).toEqual([
      'newer:ava',
      'newer:nora',
      'newer:max',
      'older:ava',
      'older:lena',
      'older:ava',
    ])
  })
})

describe('demo traffic is tagged, never dropped', () => {
  it('a demo- session sends demo:true to n8n, and still sends it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const { notified, pending } = notifyEscalation(
      'https://n8n.example/hook',
      { event: 'escalation', person: 'P', role: 'R', question: 'q', sessionId: 'demo-1', at: 'now' },
      fetchImpl,
    )
    await pending
    expect(notified.channel).toBe('n8n')
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ demo: true })
  })

  it('a normal session sends no demo field', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const { pending } = notifyEscalation(
      'https://n8n.example/hook',
      { event: 'escalation', person: 'P', role: 'R', question: 'q', sessionId: 's-1', at: 'now' },
      fetchImpl,
    )
    await pending
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).not.toHaveProperty('demo')
  })

  it('activity rows from a demo session carry demo:true', async () => {
    const DB = memoryDb()
    await recordActivity(DB, [{ agent: 'ava', action: 'Read the question', ms: 0 }], 'q', 'now', true)
    await recordActivity(DB, [{ agent: 'ava', action: 'Read the question', ms: 0 }], 'q2', 'now', false)
    const events = await getActivity(DB, 10)
    expect(events.find((e) => e.question === 'q')?.demo).toBe(true)
    expect(events.find((e) => e.question === 'q2')).not.toHaveProperty('demo')
  })
})
