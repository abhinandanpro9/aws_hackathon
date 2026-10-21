import { describe, expect, it } from 'vitest'
import { runTool } from '../src/tools/registry.js'

// "Is my child too sick to come in?" with no symptoms named must ASK, not conclude.
// FLOW: empty report -> ask which symptoms -> parent answers -> the ladder decides
// 1. saying "nothing you have described is on our stay-home list" when the parent described
//    NOTHING reads as a verdict on evidence that was never given
// 2. the ask must come back as needs_human = false is wrong too -- it is a question, and the
//    tool already has a shape for that

describe('a question with no symptoms in it', () => {
  it('asks for symptoms instead of ruling on an empty report', () => {
    const result = runTool('check_attendance', {}, [])

    expect(result.outcome).toBe('needs_detail')
    expect(result.answer.toLowerCase()).not.toContain('nothing you have described')
    // No verdict has been reached, so nothing may be cited from it.
    expect(result.sourceId).toBeNull()
    expect(result.detail['reason']).toBe('no_symptoms_given')
  })

  it('still defers to a person once symptoms are given but match nothing', () => {
    const result = runTool('check_attendance', { temperatureF: 98.6 }, [])

    expect(result.outcome).toBe('needs_human')
    expect(result.answer).toContain('stay-home list')
  })
})
