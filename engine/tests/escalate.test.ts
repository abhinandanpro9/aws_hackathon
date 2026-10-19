import { describe, expect, it } from 'vitest'
import { escalateTool } from '../src/tools/escalate.js'

// The way out. Every other tool can reach for this one.
// FLOW: model gives up, or hits a sensitive topic -> named owner from center.json -> reply
// 1. this is the only tool that answers with no source, because it claims no fact
// 2. an unknown topic still routes to a real person, never to nobody
// 3. the reply names the person and their number, because "someone will call" is not an answer

describe('escalate_to_person declaration', () => {
  it('asks why, so the person picking it up has the context', () => {
    const properties = Object.keys(escalateTool.declaration.parameters.properties)
    expect(properties).toContain('topic')
    expect(properties).toContain('question')
  })

  it('requires a topic, so the model cannot escalate into the void', () => {
    expect(escalateTool.declaration.parameters.required).toContain('topic')
  })
})

describe('escalate_to_person names a real person', () => {
  it('routes a custody question to the person who owns it', () => {
    const result = escalateTool.execute({ topic: 'custody', question: 'my ex is at pickup' })
    expect(result.outcome).toBe('needs_human')
    expect(result.routeTo).not.toBeNull()
    expect(result.answer).toContain('ext.')
  })

  it('still finds someone when the topic means nothing to us', () => {
    const result = escalateTool.execute({ topic: 'not_a_real_topic' })
    expect(result.outcome).toBe('needs_human')
    expect(result.routeTo).not.toBeNull()
  })

  it('claims no source, because it is not answering anything', () => {
    const result = escalateTool.execute({ topic: 'custody' })
    expect(result.sourceId).toBeNull()
  })
})
