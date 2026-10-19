import { beforeEach, describe, expect, it } from 'vitest'
import { getUsage, recordNearMiss, recordPolicyUse, resetUsage } from '../src/server/usage.js'

// Which policies actually answer parents, and which questions have nothing behind them.
// FLOW: an answer cites a policy -> recordPolicyUse -> the operator sees "used 3 times"
// 1. usage is what tells an operator a policy earns its keep, so a missed write reads as
//    "never used" on a policy that answered someone a minute ago
// 2. the answer cites id@version; usage is keyed on the POLICY, not the version, or every
//    edit would reset the count to zero
// 3. a near miss is a label a parent asked about with no approved policy behind it

const CITED = 'b0043a95-f687-4842-85f4-3623d9e3b8e8@1'
const POLICY_ID = 'b0043a95-f687-4842-85f4-3623d9e3b8e8'

describe('recording that a policy answered a parent', () => {
  beforeEach(() => {
    resetUsage()
  })

  it('records a use against the policy, with the version stripped off', () => {
    recordPolicyUse(CITED, ['food'], 'I forgot to pack lunch')

    expect(Object.keys(getUsage().byPolicy)).toEqual([POLICY_ID])
  })

  it('counts every time it answers', () => {
    recordPolicyUse(CITED, ['food'], 'I forgot to pack lunch')
    recordPolicyUse(CITED, ['food'], 'do you do lunch')

    expect(getUsage().byPolicy[POLICY_ID]?.timesUsed).toBe(2)
  })

  it('keeps counting across an edit, because the policy is the same policy', () => {
    recordPolicyUse(`${POLICY_ID}@1`, ['food'], 'first question')
    recordPolicyUse(`${POLICY_ID}@2`, ['food'], 'after an edit')

    const usage = getUsage()
    expect(Object.keys(usage.byPolicy)).toHaveLength(1)
    expect(usage.byPolicy[POLICY_ID]?.timesUsed).toBe(2)
  })

  it('remembers when it was last used', () => {
    recordPolicyUse(CITED, ['food'], 'I forgot to pack lunch')
    expect(getUsage().byPolicy[POLICY_ID]?.lastUsedAt).not.toBeNull()
  })

  it('keeps the questions that reached it, so an operator can read them', () => {
    recordPolicyUse(CITED, ['food'], 'I forgot to pack lunch')
    expect(getUsage().byPolicy[POLICY_ID]?.questions).toContain('I forgot to pack lunch')
  })

  it('records nothing for an answer that cited no policy', () => {
    expect(Object.keys(getUsage().byPolicy)).toHaveLength(0)
  })
})

describe('near misses', () => {
  beforeEach(() => {
    resetUsage()
  })

  it('records a label nobody has written a policy for', () => {
    recordNearMiss('tuition', 'what does it cost for infants')
    expect(Object.keys(getUsage().nearMisses)).toContain('tuition')
  })

  it('counts how often it has been asked', () => {
    recordNearMiss('tuition', 'what does it cost')
    recordNearMiss('tuition', 'infant fees please')
    expect(getUsage().nearMisses['tuition']?.timesAsked).toBe(2)
  })
})
