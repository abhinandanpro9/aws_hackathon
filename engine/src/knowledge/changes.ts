// The review gate for every change to what the front desk can say.
// FLOW: propose -> validate -> PendingChange -> approve (apply) or reject (discard)
// 1. creates, edits, and archives are all gated -- extracted drafts are not the only path in
// 2. proposing never mutates the live set; applyChange is the only function that returns new policies
// 3. a change can be reviewed once, so approving twice cannot apply twice
// WHY: an edit that skips review is a way to put unreviewed words in front of a parent

import { randomUUID } from 'node:crypto'
import type { PendingChange, PolicySnapshot, ProposeChangeInput } from '../types/changes.js'
import type { Policy } from '../types/knowledge.js'

function nowIso(): string {
  return new Date().toISOString()
}

function changeId(): string {
  return `chg_${Date.now().toString(36)}_${Math.floor(performance.now() * 1000).toString(36)}`
}

/**
 * Check a proposal before it becomes pending.
 * Returns a plain-words problem, or null when the proposal is fine.
 */
export function validateProposal(
  input: ProposeChangeInput,
  policies: readonly Policy[],
): string | null {
  if (input.proposedBy.trim().length === 0) {
    return 'We need to know who is proposing this change.'
  }

  if (input.kind === 'create' || input.kind === 'edit') {
    if (input.text === undefined || input.text.trim().length === 0) {
      return 'A policy needs some text before it can be reviewed.'
    }
    if (input.labels === undefined || input.labels.length === 0) {
      return 'A policy needs at least one label, so the front desk knows when to use it.'
    }
    // A sensitive policy is never auto-answered, so it must name a person to route to.
    if (input.sensitive === true && (input.ownerId ?? null) === null) {
      return 'A sensitive policy needs a named person. Choose who handles this.'
    }
  }

  if (input.kind === 'edit' || input.kind === 'archive') {
    const targetId = input.targetId ?? null
    if (targetId === null) {
      return 'We need to know which policy this applies to.'
    }
    if (!policies.some((p) => p.id === targetId)) {
      return 'We could not find that policy.'
    }
  }

  return null
}

/** Turn a proposal into a pending change. Nothing takes effect here. */
export function proposeChange(
  input: ProposeChangeInput,
  policies: readonly Policy[],
): PendingChange {
  const problem = validateProposal(input, policies)
  if (problem !== null) throw new Error(problem)

  const targetId = input.targetId ?? null
  const existing = targetId === null ? undefined : policies.find((p) => p.id === targetId)

  const before: PolicySnapshot | null =
    existing === undefined
      ? null
      : {
          text: existing.text,
          labels: existing.labels,
          sensitive: existing.sensitive,
          ownerId: existing.ownerId,
          reference: existing.reference,
          notes: existing.notes,
        }

  const after: PolicySnapshot | null =
    input.kind === 'archive'
      ? null
      : {
          text: (input.text ?? '').trim(),
          labels: input.labels ?? existing?.labels ?? [],
          sensitive: input.sensitive ?? existing?.sensitive ?? false,
          ownerId: input.ownerId ?? existing?.ownerId ?? null,
          reference: (input.reference ?? existing?.reference ?? '').trim(),
          notes: (input.notes ?? existing?.notes ?? '').trim(),
        }

  return {
    id: changeId(),
    kind: input.kind,
    targetId,
    before,
    after,
    proposedBy: input.proposedBy.trim(),
    proposedAt: nowIso(),
    note: input.note ?? '',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
  }
}

export interface AppliedChange {
  readonly change: PendingChange
  readonly policies: readonly Policy[]
}

/**
 * Approve a pending change and return the new policy set.
 * The reviewer's name goes on the policy, because they are the one vouching for it.
 */
export function applyChange(
  change: PendingChange,
  policies: readonly Policy[],
  reviewer: string,
): AppliedChange {
  if (change.status !== 'pending') {
    throw new Error('That change has already been reviewed.')
  }
  if (reviewer.trim().length === 0) {
    throw new Error('We need a named reviewer before applying a change.')
  }

  const reviewedAt = nowIso()
  const reviewed: PendingChange = {
    ...change,
    status: 'approved',
    reviewedBy: reviewer.trim(),
    reviewedAt,
  }

  if (change.kind === 'archive') {
    return { change: reviewed, policies: policies.filter((p) => p.id !== change.targetId) }
  }

  if (change.kind === 'edit') {
    // The id survives the edit so history and links keep working; the version moves so
    // an answer citing the old wording is refused rather than quietly shown to a parent.
    const next = policies.map((p) =>
      p.id === change.targetId && change.after !== null
        ? {
            ...p,
            version: p.version + 1,
            text: change.after.text,
            labels: change.after.labels,
            sensitive: change.after.sensitive,
            ownerId: change.after.ownerId ?? null,
            reference: change.after.reference,
            notes: change.after.notes,
            approvedBy: reviewer.trim(),
            approvedAt: reviewedAt,
          }
        : p,
    )
    return { change: reviewed, policies: next }
  }

  const after = change.after
  if (after === null) throw new Error('A create with nothing to add cannot be applied.')

  const created: Policy = {
    id: randomUUID(),
    version: 1,
    text: after.text,
    labels: after.labels,
    sensitive: after.sensitive,
    ownerId: after.ownerId ?? null,
    // A policy with no stated source says so plainly rather than implying a handbook page.
    reference:
      after.reference.length > 0
        ? after.reference
        : `Written by ${change.proposedBy}, approved by ${reviewer.trim()}`,
    notes: after.notes,
    approvedBy: reviewer.trim(),
    approvedAt: reviewedAt,
  }

  return { change: reviewed, policies: [created, ...policies] }
}

/** Turn down a pending change. The live policies are untouched. */
export function rejectChange(change: PendingChange, reviewer: string): PendingChange {
  if (change.status !== 'pending') {
    throw new Error('That change has already been reviewed.')
  }
  return { ...change, status: 'rejected', reviewedBy: reviewer.trim(), reviewedAt: nowIso() }
}
