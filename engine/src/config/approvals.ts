// Which changes need a review before they take effect.
// FLOW: proposal -> needsApproval() -> pending queue, or applied straight away
// 1. a center that trusts its director can set requireApproval to false and move faster
// 2. sensitive is non-negotiable and wins over every setting here, but that check lives with
//    the policy record rather than in this config, because sensitivity is data now
// 3. this is config so the rule can change without touching the gate's logic

import type { ChangeKind } from '../types/changes.js'

export interface ApprovalPolicy {
  /** Master switch. False means changes apply immediately unless the policy is sensitive. */
  readonly requireApproval: boolean
  /** Which kinds of change need review when requireApproval is true. */
  readonly reviewKinds: readonly ChangeKind[]
  /** Who reviews by default when nobody is named. */
  readonly defaultReviewer: string
}

export const APPROVAL_POLICY: ApprovalPolicy = {
  requireApproval: true,
  reviewKinds: ['create', 'edit', 'archive'],
  defaultReviewer: 'Rosa Delgado',
}

/**
 * Does this change need a human to look at it first?
 * Sensitivity is NOT checked here: it lives on the policy record, and the caller applies it,
 * so a policy marked sensitive always waits for a person whatever this returns.
 */
export function needsApproval(
  kind: ChangeKind,
  policy: ApprovalPolicy = APPROVAL_POLICY,
): boolean {
  if (!policy.requireApproval) return false
  return policy.reviewKinds.includes(kind)
}
