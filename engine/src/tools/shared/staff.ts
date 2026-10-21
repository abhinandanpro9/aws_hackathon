// Who a question goes to when the front desk will not answer it.
// FLOW: topic -> center.json sensitive_topics -> staff member -> a name, role, and number
// 1. an unknown topic still lands on the default owner, never on nobody
// 2. the wording always carries a number, because "someone will be in touch" is not an answer
// 3. every tool routes through here, so there is one place a center edits its escalation map

import centerData from '../../../data/center.json' with { type: 'json' }

export interface StaffMember {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly phone: string
  readonly ext: string
}

const STAFF: readonly StaffMember[] = centerData.staff
const DEFAULT_OWNER_ID: string = centerData.escalation.default_owner

/** A staff member by id, falling back to the center's default owner. */
export function findStaff(id: string): StaffMember {
  const found = STAFF.find((s) => s.id === id)
  if (found !== undefined) return found

  const fallback = STAFF.find((s) => s.id === DEFAULT_OWNER_ID)
  if (fallback === undefined) throw new Error('Center data has no default escalation owner.')
  return fallback
}

/** Map a topic id to the person who owns it. Unknown topics go to the default owner. */
export function ownerForTopic(topic: string): StaffMember {
  const match = centerData.sensitive_topics.topics.find((t) => t.id === topic)
  return findStaff(match?.route_to ?? DEFAULT_OWNER_ID)
}

/** The person, written the way a parent needs to see them. */
export function describeOwner(staff: StaffMember): string {
  return `${staff.name}, ${staff.role} (${staff.phone} ext. ${staff.ext})`
}

/** The default owner, for tools that fail before they know the topic. */
export function defaultOwner(): StaffMember {
  return findStaff(DEFAULT_OWNER_ID)
}
