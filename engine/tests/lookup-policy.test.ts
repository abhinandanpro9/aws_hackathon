import { describe, expect, it } from 'vitest'
import { lookupPolicyTool } from '../src/tools/lookup-policy.js'
import type { Policy } from '../src/types/knowledge.js'

// Reading an approved passage back to a parent, and proving where it came from.
// FLOW: model asks for a topic -> approved entries searched -> text + its own id returned
// 1. the entry's id IS the source id the model must cite; nothing else counts
// 2. a topic with no approved entry is an honest gap, never an invented answer
// 3. the text is returned verbatim, because an operator approved those exact words

const entry = (id: string, topic: string, text: string): Policy => ({
  id,
  version: 1,
  labels: [topic],
  text,
  sensitive: false,
  ownerId: null,
  reference: `Family Handbook, ${topic}`,
  notes: '',
  approvedBy: 'Rosa Delgado',
  approvedAt: '2026-08-12T10:00:00.000Z',
})

const APPROVED: readonly Policy[] = [
  entry('seed-food', 'food', 'Meals are always provided, so a forgotten lunch is never a problem.'),
  entry('seed-pickup', 'pickup', 'Pickup is by 5:30pm. Anyone collecting must be on your approved list.'),
]

describe('lookup_policy declaration', () => {
  it('offers only the labels that actually have an approved policy', () => {
    const topics = lookupPolicyTool.declaration(APPROVED).parameters.properties['label']?.enum
    expect(topics).toEqual(['food', 'pickup'])
  })

  it('offers nothing at all when no policy has been approved yet', () => {
    const topics = lookupPolicyTool.declaration([]).parameters.properties['label']?.enum
    expect(topics).toEqual([])
  })

  it('requires a label, so the model cannot ask for "a policy" in general', () => {
    expect(lookupPolicyTool.declaration(APPROVED).parameters.required).toContain('label')
  })
})

describe('lookup_policy returns approved words and their source', () => {
  it('returns the approved text verbatim', () => {
    const result = lookupPolicyTool.execute({ label: 'food' }, APPROVED)
    expect(result.outcome).toBe('answered')
    expect(result.answer).toBe(APPROVED[0]?.text)
  })

  it('hands back the entry id AND its version as the source the model must cite', () => {
    const result = lookupPolicyTool.execute({ label: 'food' }, APPROVED)
    expect(result.sourceId).toBe('seed-food@1')
  })

  it('carries the citation a parent can check', () => {
    const result = lookupPolicyTool.execute({ label: 'pickup' }, APPROVED)
    expect(result.citation).toBe('Family Handbook, pickup')
  })
})

describe('lookup_policy admits a gap rather than inventing one', () => {
  it('needs a human when no passage has been approved for the topic', () => {
    const result = lookupPolicyTool.execute({ label: 'tuition' }, APPROVED)
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
    expect(result.routeTo).not.toBeNull()
  })

  it('needs a human when the model sends no label at all', () => {
    const result = lookupPolicyTool.execute({}, APPROVED)
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
  })

  it('needs a human when nothing has been approved yet', () => {
    const result = lookupPolicyTool.execute({ label: 'food' }, [])
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
  })
})
