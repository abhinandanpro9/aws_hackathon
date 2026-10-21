import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'

// Whether the center is open on a given day.
// FLOW: model passes what the parent said -> closure rule -> answered, or an owned gap
// 1. this year's closure calendar is a KNOWN GAP; the rule says so rather than guessing
// 2. a gap names the person who has the calendar, so the parent still gets their answer
// 3. weekends are answered from data, because that never changes

describe('check_closures declaration', () => {
  it('asks the model what KIND of question this is, rather than reading the wording', () => {
    const ask = getCenterFactsTool.declaration.parameters.properties['ask']
    expect(ask?.enum).toEqual(['specific_day', 'weather', 'holiday_calendar'])
  })

  it('takes a real date separately, because a date is the only thing it can answer outright', () => {
    expect(Object.keys(getCenterFactsTool.declaration.parameters.properties)).toContain('date')
  })
})

describe('check_closures answers what it can', () => {
  it('answers a weekend date from the center data', () => {
    // 2026-08-29 is a Saturday. The rule reads the date; it never parses "Saturday" from prose.
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date: '2026-08-29' })
    expect(result.outcome).toBe('answered')
    expect(result.answer.toLowerCase()).toContain('closed')
    expect(result.sourceId).toBe('center:closures')
  })

  it('answers an ordinary weekday date with the opening times', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'specific_day', date: '2026-08-26' })
    expect(result.outcome).toBe('answered')
    expect(result.sourceId).toBe('center:closures')
  })
})

describe('check_closures owns its gaps', () => {
  it('answers the calendar question from the published list', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'holiday_calendar' })
    expect(result.outcome).toBe('answered')
    // A stated fact carries a source, the same as any other closure answer.
    expect(result.sourceId).not.toBeNull()
  })

  it('hands a weather closure to the school district that owns it', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'weather' })
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
  })

  it('needs a human when the model sent no kind at all', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures' })
    expect(result.outcome).toBe('needs_human')
    expect(result.sourceId).toBeNull()
  })

  it('needs a human when the model invented a kind we do not handle', () => {
    const result = getCenterFactsTool.execute({ topic: 'closures', ask: 'made_up_kind' })
    expect(result.outcome).toBe('needs_human')
  })
})
