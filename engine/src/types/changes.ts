// Every change to what the front desk can say, before it takes effect.
// FLOW: operator proposes -> PendingChange -> a reviewer approves -> applied to the live policies
// 1. creates, edits, and archives all go through the same gate, not just extracted drafts
// 2. a proposal never mutates the live set; only approval does
// 3. the reviewer must be a different action from the proposal, so nothing self-approves silently


export const CHANGE_KINDS = ['create', 'edit', 'archive'] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

export const CHANGE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ChangeStatus = (typeof CHANGE_STATUSES)[number]

/** What a policy looked like before a proposed change, so a reviewer can compare. */
export interface PolicySnapshot {
  /** What the front desk says. */
  readonly text: string
  readonly labels: readonly string[]
  /** True when this must always reach a person. */
  readonly sensitive: boolean
  /** Staff id who handles this, required when sensitive. */
  readonly ownerId?: string | null
  /** Where this came from. A parent can check it. */
  readonly reference: string
  /** Operator commentary. Never shown to a parent. */
  readonly notes: string
}

export interface PendingChange {
  readonly id: string
  readonly kind: ChangeKind
  /** The policy being changed. Null for a create, since it does not exist yet. */
  readonly targetId: string | null
  /** Current state of the policy. Null for a create. */
  readonly before: PolicySnapshot | null
  /** Proposed state. Null for an archive, since nothing replaces it. */
  readonly after: PolicySnapshot | null
  readonly proposedBy: string
  readonly proposedAt: string
  /** Why the operator wants this. Shown to the reviewer. */
  readonly note: string
  readonly status: ChangeStatus
  readonly reviewedBy: string | null
  readonly reviewedAt: string | null
}

export interface ProposeChangeInput {
  readonly kind: ChangeKind
  readonly targetId?: string | null
  readonly text?: string
  readonly labels?: readonly string[]
  readonly sensitive?: boolean
  readonly proposedBy: string
  readonly note?: string
  /** Staff id who handles this. Required when the policy is sensitive. */
  readonly ownerId?: string | null
  /** Where this came from. A parent can check it. */
  readonly reference?: string
  /** Operator commentary. Never shown to a parent. */
  readonly notes?: string
}
