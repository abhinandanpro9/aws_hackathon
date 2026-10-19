import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// Opening and closing times, per room, from the center's own data.
// FLOW: model calls with a program -> schedule rule reads center.json -> times + source id
// 1. rooms finish at different times, so a question with no room asks which one
// 2. asking back is not a failure: it is the tool refusing to average four answers into one
// 3. the source id is fixed because the answer always comes from the same block of data

describe('get_hours declaration', () => {
  it('offers the rooms the center actually runs', () => {
    const programs = getCenterFactsTool.declaration.parameters.properties['programId']?.enum
    expect(programs).toEqual(['infant', 'toddler', 'preschool', 'prek'])
  })

  it('leaves the room optional, because "what time do you open" is a fair question', () => {
    expect(getCenterFactsTool.declaration.parameters.required ?? []).not.toContain('programId')
  })
})

describe('get_hours answers from the center data', () => {
  it('answers a specific room with its own times', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours', programId: 'preschool' })
    expect(result.outcome).toBe('answered')
    expect(result.sourceId).toBe('center:hours')
  })

  it('asks which room when the question could mean any of them', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours' })
    expect(result.outcome).toBe('needs_detail')
    expect(result.answer.toLowerCase()).toContain('room')
    expect(result.sourceId).toBe('center:hours')
  })

  it('treats a room it does not run as a question it cannot answer', () => {
    const result = getCenterFactsTool.execute({ topic: 'hours', programId: 'after_school' })
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
  })
})
