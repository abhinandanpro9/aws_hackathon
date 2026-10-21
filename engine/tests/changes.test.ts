import { beforeEach, describe, expect, it } from 'vitest'
import { applyChange, proposeChange, rejectChange, validateProposal } from '../src/knowledge/changes.js'
import type { Policy } from '../src/types/knowledge.js'
import { needsApproval } from '../src/config/approvals.js'
import type { PendingChange } from '../src/types/changes.js'

// Every change to what the front desk can say goes through review first.
// FLOW: propose -> pending -> approve or reject -> only approval touches the live policies
// 1. creates, edits, and archives are all gated, not just extracted drafts
// 2. a proposal never mutates the live set
// 3. approving twice must not apply twice

const EXISTING: Policy = {
  id: 'p1',
  version: 1,
  labels: ['food'],
  text: 'Meals are included in tuition.',
  sensitive: false,
  ownerId: null,
  reference: 'Family Handbook, Page 8',
  notes: '',
  approvedBy: 'Rosa Delgado',
  approvedAt: '2026-08-12T10:00:00.000Z',
}

let policies: Policy[]

beforeEach(() => {
  policies = [{ ...EXISTING }]
})

describe('proposeChange - nothing takes effect yet', () => {
  it('creates a pending change for a new policy', () => {
    const change = proposeChange(
      { kind: 'create', text: 'Tours run on Tuesdays.', labels: ['tours'], proposedBy: 'Priya Raman' },
      policies,
    )
    expect(change.status).toBe('pending')
    expect(change.kind).toBe('create')
    expect(change.after?.text).toContain('Tours run')
  })

  it('does not add the policy to the live set when proposing a create', () => {
    proposeChange({ kind: 'create', text: 'New policy.', labels: ['tours'], proposedBy: 'Priya Raman' }, policies)
    expect(policies).toHaveLength(1)
  })

  it('records what a policy looked like before an edit', () => {
    const change = proposeChange(
      { kind: 'edit', targetId: 'p1', text: 'Meals and snacks are included.', labels: ['food'], proposedBy: 'Priya Raman' },
      policies,
    )
    expect(change.before?.text).toBe('Meals are included in tuition.')
    expect(change.after?.text).toBe('Meals and snacks are included.')
  })

  it('does not change the live policy when proposing an edit', () => {
    proposeChange({ kind: 'edit', targetId: 'p1', text: 'Changed.', labels: ['food'], proposedBy: 'Priya Raman' }, policies)
    expect(policies[0]?.text).toBe('Meals are included in tuition.')
  })

  it('records an archive with no replacement', () => {
    const change = proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya Raman' }, policies)
    expect(change.after).toBeNull()
    expect(change.before?.text).toBe('Meals are included in tuition.')
  })

  it('does not remove the policy when proposing an archive', () => {
    proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya Raman' }, policies)
    expect(policies).toHaveLength(1)
  })

  it('carries the operator note through to the reviewer', () => {
    const change = proposeChange(
      { kind: 'archive', targetId: 'p1', proposedBy: 'Priya Raman', note: 'We changed caterers.' },
      policies,
    )
    expect(change.note).toContain('caterers')
  })
})

describe('validateProposal - bad proposals are refused up front', () => {
  it('refuses a create with no text', () => {
    expect(validateProposal({ kind: 'create', labels: ['tours'], proposedBy: 'Priya' }, policies)).toMatch(/text/i)
  })

  it('refuses a create with no label', () => {
    expect(validateProposal({ kind: 'create', text: 'Something.', proposedBy: 'Priya' }, policies)).toMatch(/label/i)
  })

  it('refuses an edit that names no policy', () => {
    expect(validateProposal({ kind: 'edit', text: 'x', labels: ['food'], proposedBy: 'Priya' }, policies)).toMatch(/which policy/i)
  })

  it('refuses an edit to a policy that does not exist', () => {
    expect(
      validateProposal({ kind: 'edit', targetId: 'nope', text: 'x', labels: ['food'], proposedBy: 'Priya' }, policies),
    ).toMatch(/not find/i)
  })

  it('refuses a proposal with no named proposer', () => {
    expect(validateProposal({ kind: 'create', text: 'x', labels: ['food'], proposedBy: '  ' }, policies)).toMatch(/who/i)
  })

  it('accepts a valid proposal', () => {
    expect(validateProposal({ kind: 'create', text: 'x', labels: ['food'], proposedBy: 'Priya' }, policies)).toBeNull()
  })
})

describe('applyChange - only approval touches the live policies', () => {
  function pendingCreate(): PendingChange {
    return proposeChange(
      { kind: 'create', text: 'Tours run on Tuesdays.', labels: ['tours'], proposedBy: 'Priya Raman' },
      policies,
    )
  }

  it('adds the policy when a create is approved', () => {
    const next = applyChange(pendingCreate(), policies, 'Rosa Delgado')
    expect(next.policies).toHaveLength(2)
    expect(next.policies[0]?.text).toContain('Tours run')
  })

  it('records who approved it and when', () => {
    const next = applyChange(pendingCreate(), policies, 'Rosa Delgado')
    expect(next.change.status).toBe('approved')
    expect(next.change.reviewedBy).toBe('Rosa Delgado')
    expect(next.change.reviewedAt).not.toBeNull()
  })

  it('stamps the new policy with the reviewer, not the proposer', () => {
    const next = applyChange(pendingCreate(), policies, 'Rosa Delgado')
    expect(next.policies[0]?.approvedBy).toBe('Rosa Delgado')
  })

  it('applies an edit to the live policy', () => {
    const change = proposeChange(
      { kind: 'edit', targetId: 'p1', text: 'Meals and snacks are included.', labels: ['food'], proposedBy: 'Priya' },
      policies,
    )
    const next = applyChange(change, policies, 'Rosa Delgado')
    expect(next.policies[0]?.text).toBe('Meals and snacks are included.')
  })

  it('removes the policy when an archive is approved', () => {
    const change = proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya' }, policies)
    const next = applyChange(change, policies, 'Rosa Delgado')
    expect(next.policies).toHaveLength(0)
  })

  it('refuses to apply a change that is not pending', () => {
    const applied = applyChange(pendingCreate(), policies, 'Rosa Delgado')
    expect(() => applyChange(applied.change, applied.policies, 'Rosa Delgado')).toThrow(/already/i)
  })

  it('refuses to apply without a named reviewer', () => {
    expect(() => applyChange(pendingCreate(), policies, '  ')).toThrow(/reviewer/i)
  })
})

describe('rejectChange - a rejection changes nothing', () => {
  it('marks the change rejected', () => {
    const change = proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya' }, policies)
    const rejected = rejectChange(change, 'Rosa Delgado')
    expect(rejected.status).toBe('rejected')
    expect(rejected.reviewedBy).toBe('Rosa Delgado')
  })

  it('leaves the live policies untouched', () => {
    const change = proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya' }, policies)
    rejectChange(change, 'Rosa Delgado')
    expect(policies).toHaveLength(1)
  })

  it('refuses to reject something already reviewed', () => {
    const change = proposeChange({ kind: 'archive', targetId: 'p1', proposedBy: 'Priya' }, policies)
    const rejected = rejectChange(change, 'Rosa Delgado')
    expect(() => rejectChange(rejected, 'Rosa Delgado')).toThrow(/already/i)
  })
})

describe('sensitive policies keep their guarantee', () => {
  it('an approved sensitive policy is still marked sensitive', () => {
    const change = proposeChange(
      {
        kind: 'create',
        text: 'Custody questions go to the Director.',
        labels: ['custody'],
        sensitive: true,
        proposedBy: 'Priya',
        ownerId: 'dir-1',
      },
      policies,
    )
    const next = applyChange(change, policies, 'Rosa Delgado')
    expect(next.policies[0]?.sensitive).toBe(true)
  })
})

describe('needsApproval - the gate is config, not hardcoded', () => {
  const strict = {
    requireApproval: true,
    reviewKinds: ['create', 'edit', 'archive'] as const,
    defaultReviewer: 'Rosa Delgado',
  }
  const relaxed = { ...strict, requireApproval: false }
  const editsOnly = { ...strict, reviewKinds: ['edit'] as const }

  it('requires review for every kind by default', () => {
    expect(needsApproval('create', strict)).toBe(true)
    expect(needsApproval('edit', strict)).toBe(true)
    expect(needsApproval('archive', strict)).toBe(true)
  })

  it('lets a trusting center skip review', () => {
    expect(needsApproval('create', relaxed)).toBe(false)
  })

  it('can require review for only some kinds', () => {
    expect(needsApproval('edit', editsOnly)).toBe(true)
    expect(needsApproval('create', editsOnly)).toBe(false)
  })
})

describe('sensitive policies name who handles them', () => {
  it('carries the owner through a proposal', () => {
    const change = proposeChange(
      {
        kind: 'create',
        text: 'Custody questions go to the Director.',
        labels: ['custody'],
        sensitive: true,
        proposedBy: 'Priya',
        ownerId: 'dir-1',
      },
      policies,
    )
    expect(change.after?.ownerId).toBe('dir-1')
  })

  it('keeps the owner on the approved policy', () => {
    const change = proposeChange(
      { kind: 'create', text: 'Allergy questions go to health.', sensitive: true, labels: ['sensitive'], proposedBy: 'Priya', ownerId: 'hlt-1' },
      policies,
    )
    const next = applyChange(change, policies, 'Rosa Delgado')
    expect(next.policies[0]?.ownerId).toBe('hlt-1')
  })

  it('refuses a sensitive policy with nobody to handle it', () => {
    expect(
      validateProposal(
        { kind: 'create', text: 'Custody stuff.', sensitive: true, labels: ['sensitive'], proposedBy: 'Priya' },
        policies,
      ),
    ).toMatch(/who handles/i)
  })

  it('does not require an owner for an ordinary topic', () => {
    expect(
      validateProposal({ kind: 'create', text: 'Meals included.', labels: ['food'], proposedBy: 'Priya' }, policies),
    ).toBeNull()
  })
})
