import { beforeEach, describe, expect, it } from 'vitest'
import { getUsage, recordNearMiss, recordPolicyUse, resetUsage } from '../src/server/usage.js'

// What the operator needs to see: which policies earn their keep, and where the gaps are.
// FLOW: an answer cites a policy -> recordPolicyUse -> counts, last used, and the questions
// 1. a policy never cited is as informative as one cited often
// 2. a near miss is a topic a parent asked about with no approved policy behind it
// 3. this is the data that tells an operator where to spend the next thirty seconds

beforeEach(() => {
  resetUsage()
})

describe('recordPolicyUse', () => {
  it('counts each time a policy is cited', () => {
    recordPolicyUse('p1', ['food'], 'I forgot lunch')
    recordPolicyUse('p1', ['food'], 'do you feed them')
    expect(getUsage().byPolicy['p1']?.timesUsed).toBe(2)
  })

  it('records when it was last used', () => {
    recordPolicyUse('p1', ['food'], 'I forgot lunch')
    expect(getUsage().byPolicy['p1']?.lastUsedAt).not.toBeNull()
  })

  it('keeps the questions that hit it', () => {
    recordPolicyUse('p1', ['food'], 'I forgot lunch')
    recordPolicyUse('p1', ['food'], 'is lunch included')
    expect(getUsage().byPolicy['p1']?.questions).toContain('is lunch included')
  })

  it('does not let one policy grow without bound', () => {
    for (let i = 0; i < 30; i += 1) recordPolicyUse('p1', ['food'], `question ${i}`)
    expect(getUsage().byPolicy['p1']?.questions.length).toBeLessThanOrEqual(10)
  })

  it('keeps the most recent questions, not the oldest', () => {
    for (let i = 0; i < 15; i += 1) recordPolicyUse('p1', ['food'], `question ${i}`)
    expect(getUsage().byPolicy['p1']?.questions[0]).toBe('question 14')
  })

  it('tracks policies separately', () => {
    recordPolicyUse('p1', ['food'], 'lunch')
    recordPolicyUse('p2', ['tours'], 'tour')
    expect(getUsage().byPolicy['p1']?.timesUsed).toBe(1)
    expect(getUsage().byPolicy['p2']?.timesUsed).toBe(1)
  })
})

describe('recordNearMiss - topics with nothing behind them', () => {
  it('counts a topic asked about with no approved policy', () => {
    recordNearMiss('tuition', 'what is infant tuition')
    recordNearMiss('tuition', 'how much per month')
    expect(getUsage().nearMisses['tuition']?.timesAsked).toBe(2)
  })

  it('keeps the wording so an operator can write the policy', () => {
    recordNearMiss('tuition', 'what is infant tuition')
    expect(getUsage().nearMisses['tuition']?.questions).toContain('what is infant tuition')
  })

  it('separates near misses by topic', () => {
    recordNearMiss('tuition', 'cost')
    recordNearMiss('hours', 'closing time')
    expect(Object.keys(getUsage().nearMisses)).toHaveLength(2)
  })
})

describe('unused policies are visible', () => {
  it('reports nothing for a policy never cited', () => {
    recordPolicyUse('p1', ['food'], 'lunch')
    expect(getUsage().byPolicy['p2']).toBeUndefined()
  })
})

describe('resetUsage', () => {
  it('clears everything', () => {
    recordPolicyUse('p1', ['food'], 'lunch')
    recordNearMiss('tuition', 'cost')
    resetUsage()
    expect(Object.keys(getUsage().byPolicy)).toHaveLength(0)
    expect(Object.keys(getUsage().nearMisses)).toHaveLength(0)
  })
})
