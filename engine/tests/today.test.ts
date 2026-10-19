import { describe, expect, it } from 'vitest'
import { conversePrompt } from '../src/prompts/converse.js'
import { centerToday } from '../src/rules/schedule.js'

// "Is the school open today" must resolve, not escalate.
// FLOW: askedAt -> centre's own timezone -> today's date in the prompt -> model fills date
// 1. the model was told to leave the date out unless certain, and was never told what day it
//    is, so every "today" and "tomorrow" became a vague day and went to a person
// 2. the centre's timezone decides the date, not the server's: a parent asking at 9pm Pacific
//    is asking about a day that is already tomorrow in UTC

describe('the centre knows what day it is', () => {
  it('reads the date in the centre timezone, not UTC', () => {
    // 03:00 UTC on the 10th is still the 9th in America/Los_Angeles.
    expect(centerToday('2026-08-10T03:00:00Z')).toBe('2026-08-09')
  })

  it('keeps the same day when the centre and UTC agree', () => {
    expect(centerToday('2026-08-09T19:00:00Z')).toBe('2026-08-09')
  })

  it('tells the model what today is, with the weekday named', () => {
    const prompt = conversePrompt('2026-08-10T03:00:00Z')
    expect(prompt).toContain('2026-08-09')
    expect(prompt).toContain('Sunday')
  })

  it('still contains the standing instructions', () => {
    expect(conversePrompt('2026-08-09T19:00:00Z')).toContain('You are Sunny')
  })
})
