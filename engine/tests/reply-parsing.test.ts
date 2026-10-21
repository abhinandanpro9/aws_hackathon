import { describe, expect, it } from 'vitest'
import { parseReply } from '../src/llm/reply.js'

// Reading what the model said, without trusting how it said it.
// FLOW: raw model text -> parseReply -> { text, citedSource } -> the loop checks the source
// 1. JSON is asked for because a missing FIELD is detectable, while a missing line is not:
//    prose that forgot its source line looks exactly like prose that claimed no fact
// 2. a reply that is not JSON is still shown to the parent as text, with no source, so the
//    guardrail treats it as an unsourced claim rather than crashing on it
// 3. code fences are stripped because models add them whatever the instruction says

describe('a well-formed reply', () => {
  it('reads the answer and the sources', () => {
    const parsed = parseReply('{"answer":"We close at 5:30pm.","sources":["center:hours"]}')
    expect(parsed.text).toBe('We close at 5:30pm.')
    expect(parsed.citedSource).toBe('center:hours')
  })

  it('joins several sources, so an answer resting on two tools keeps both', () => {
    const parsed = parseReply('{"answer":"Both things.","sources":["center:hours","abc@1"]}')
    expect(parsed.citedSource).toBe('center:hours, abc@1')
  })

  it('reports no source when the model claimed no fact', () => {
    const parsed = parseReply('{"answer":"Hello there.","sources":[]}')
    expect(parsed.text).toBe('Hello there.')
    expect(parsed.citedSource).toBeNull()
  })

  it('strips a code fence the model added anyway', () => {
    const parsed = parseReply('```json\n{"answer":"Hi.","sources":[]}\n```')
    expect(parsed.text).toBe('Hi.')
  })

  it('ignores prose the model wrapped around the JSON', () => {
    const parsed = parseReply('Sure! {"answer":"Hi.","sources":[]} Hope that helps.')
    expect(parsed.text).toBe('Hi.')
  })
})

describe('a malformed reply is a value, never a crash', () => {
  it('falls back to the raw text when the model did not send JSON', () => {
    const parsed = parseReply('We close at 5:30pm.')
    expect(parsed.text).toBe('We close at 5:30pm.')
  })

  it('claims no source for a non-JSON reply, so the guardrail treats it as unsourced', () => {
    expect(parseReply('We close at 5:30pm.').citedSource).toBeNull()
  })

  it('survives JSON that is missing the answer field', () => {
    const parsed = parseReply('{"sources":["center:hours"]}')
    expect(parsed.text).toBe('')
  })

  it('survives sources being the wrong type', () => {
    const parsed = parseReply('{"answer":"Hi.","sources":"center:hours"}')
    expect(parsed.text).toBe('Hi.')
    expect(parsed.citedSource).toBeNull()
  })

  it('drops non-string entries from the sources list', () => {
    const parsed = parseReply('{"answer":"Hi.","sources":["center:hours",7,null]}')
    expect(parsed.citedSource).toBe('center:hours')
  })

  it('returns empty text for an empty reply', () => {
    expect(parseReply('').text).toBe('')
  })
})
