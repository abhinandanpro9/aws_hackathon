import { describe, expect, it } from 'vitest'
import { draftsFromModelReply, EXTRACT_WORD_LIMIT } from '../src/knowledge/extract.js'

// Pasted handbook text becomes DRAFTS, never live policies.
// FLOW: operator pastes -> model extracts JSON -> code validates every draft -> the queue
// 1. the model reads and structures; code decides what counts as a usable draft
// 2. a malformed item is dropped, not repaired: an invented policy is worse than a missing one
// 3. everything it produces still waits for a person -- extraction never skips review

describe('reading the model extraction reply', () => {
  it('accepts a clean array of drafts', () => {
    const raw = JSON.stringify([
      { text: 'Children nap after lunch.', labels: ['nap'], sensitive: false, reference: 'Handbook, Naps' },
      { text: 'Bring a labeled water bottle.', labels: ['what-to-bring'], sensitive: false, reference: 'Handbook, Items' },
    ])
    const drafts = draftsFromModelReply(raw)
    expect(drafts.length).toBe(2)
    expect(drafts[0]?.labels).toEqual(['nap'])
  })

  it('copes with code fences around the JSON', () => {
    const raw = '```json\n[{"text":"T.","labels":["a"],"sensitive":false,"reference":"R"}]\n```'
    expect(draftsFromModelReply(raw).length).toBe(1)
  })

  it('drops items with no text, no labels, or no reference', () => {
    const raw = JSON.stringify([
      { text: '', labels: ['a'], sensitive: false, reference: 'R' },
      { text: 'T', labels: [], sensitive: false, reference: 'R' },
      { text: 'T', labels: ['a'], sensitive: false, reference: '' },
      { text: 'Good one.', labels: ['a'], sensitive: false, reference: 'R' },
    ])
    expect(draftsFromModelReply(raw).length).toBe(1)
  })

  it('returns nothing for a reply that is not an array', () => {
    expect(draftsFromModelReply('I could not find any policies.')).toEqual([])
    expect(draftsFromModelReply('{"text":"one object"}')).toEqual([])
  })

  it('caps a runaway extraction', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      text: `Policy ${i}.`, labels: ['a'], sensitive: false, reference: 'R',
    }))
    expect(draftsFromModelReply(JSON.stringify(many)).length).toBeLessThanOrEqual(25)
  })

  it('normalises labels to trimmed lowercase', () => {
    const raw = JSON.stringify([{ text: 'T.', labels: [' Meals ', 'FOOD'], sensitive: false, reference: 'R' }])
    expect(draftsFromModelReply(raw)[0]?.labels).toEqual(['meals', 'food'])
  })

  it('exposes the word limit the UI and server both enforce', () => {
    expect(EXTRACT_WORD_LIMIT).toBeGreaterThan(1000)
  })
})
