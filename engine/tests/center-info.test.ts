import { describe, expect, it } from 'vitest'
import { getCenterFactsTool } from '../src/tools/get-center-facts.js'
import centerData from '../data/center.json' with { type: 'json' }

// General facts about the centre itself: what it is, who it takes, how big the rooms are.
// FLOW: "tell me about your school" -> get_center_info -> the centre block + the four rooms
// 1. this data was in center.json and reachable by nothing. get_hours reads program_hours and
//    ignores ages, ratios and capacity, so a question about the centre had no tool at all.
// 2. asked "tell me everything about your school", the model reached for an ENROLLMENT POLICY
//    instead -- policy 29, titled EARLY HEAD START ENROLLMENT -- and read one programme's age
//    rule as the whole centre's. A real citation, a claim wider than its source.
// 3. asked how many children are in the toddler room it escalated, though ratio and capacity
//    are both sitting in the data.

describe('the centre can describe itself', () => {
  it('answers with a source id, like every other fact', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })

    expect(result.outcome).toBe('answered')
    expect(result.sourceId).toBe('center:about')
  })

  it('gives the age range across ALL rooms, not one programme', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })

    // 6 months to 71 months: infants through Pre-K, not the six-weeks-to-three-years rule
    // that belongs to Early Head Start enrollment alone.
    expect(result.answer).toContain('6 months')
    expect(result.answer).toContain('5')
  })

  it('names every room', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })

    for (const program of centerData.programs) {
      expect(result.answer).toContain(program.name)
    }
  })

  it('states no ratio, and no licensed capacity', () => {
    // Neither appears in any approved handbook policy -- both sit in the centre record, which
    // is operational data. A ratio sourced from us and quoted at a licensing inspector is a
    // compliance problem, so those questions belong to the Director.
    const result = getCenterFactsTool.execute({ topic: 'about' })

    for (const program of centerData.programs) {
      expect(result.answer).not.toContain(program.ratio)
    }
    expect(result.answer).not.toContain(String(centerData.center.licensed_capacity))
    expect(result.answer).not.toContain(centerData.center.license_number)
  })

  it('carries the accreditation, which is a public claim the centre makes', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })

    expect(result.answer).toContain('NAEYC')
  })

  it('never invents a number the data does not hold', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })

    // Enrolment counts are not in center.json. Capacity is the ceiling, not a roll count.
    expect(result.answer.toLowerCase()).not.toContain('currently enrolled')
  })
})

describe('the room count follows the data', () => {
  it('states the number of rooms from programs, never a hardcoded word', () => {
    const result = getCenterFactsTool.execute({ topic: 'about' })
    expect(result.answer).toContain('4 rooms')
    expect(result.answer).not.toContain('four rooms')
  })
})
