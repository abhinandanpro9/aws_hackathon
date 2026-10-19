// Knowledge base types. What the front desk is allowed to say, and who signed it off.
// FLOW: operator writes a policy -> review gate -> approved -> lookup_policy reads it -> parent
// 1. one shape for every policy, whatever it is about
// 2. only an approved policy may be cited in a parent-facing answer
// 3. structured facts -- hours, closures, tours, the illness ladder -- stay in center.json,
//    because code computes over them rather than reading a sentence

/** What a draft is about. Mirrors the intent classes an answer can be built from. */
export const TOPIC_IDS = [
  'hours',
  'closures',
  'illness',
  'medication',
  'food',
  'tuition',
  'enrollment',
  'tours',
  'pickup',
  'attendance',
  'daily',
  'sensitive',
] as const
export type TopicId = (typeof TOPIC_IDS)[number]

/**
 * One approved answer, in the one shape every policy uses.
 * FLOW: operator writes -> review gate -> approved -> lookup_policy reads it -> parent
 * 1. every policy has the same fields, whatever it is about. A per-topic shape was the old
 *    mistake: it meant the code had to know which field name held the sentence.
 * 1b. there is no stored question. An operator states what is true and tags it; a stored
 *    question would be one guess at phrasing, and parents phrase things a hundred ways.
 * 2. reference is WHERE IT CAME FROM and is shown to a parent; notes are for the operator
 *    and never leave the control panel. Mixing them puts internal remarks in a citation.
 * 3. labels replace a single topic, because a policy can be about more than one thing
 */
export interface Policy {
  readonly id: string
  readonly version: number
  /** What the front desk says, verbatim. The operator states the policy; nobody guesses
   *  at how a parent will phrase the question. Retrieval is by label. */
  readonly text: string
  readonly labels: readonly string[]
  /** True when this must always reach a person, whatever the question looks like. */
  readonly sensitive: boolean
  readonly ownerId: string | null
  /** Where this came from. A parent can check it. */
  readonly reference: string
  /** Operator commentary. Never shown to a parent. */
  readonly notes: string
  readonly approvedBy: string
  readonly approvedAt: string
}
