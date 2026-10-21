// The approved knowledge base the eval runs against.
// FLOW: center.json policies -> the same seed the server uses -> answerQuestion
// 1. the eval runs against the REAL policy set, because a fixture that drifts from it grades
//    a system nobody ships: cases pass here and fail in front of a parent, or the reverse
// 2. still deliberately PARTIAL where it counts -- nothing covers tuition or staff ratios, so
//    the honest "I do not have that" stays testable
// 3. a stub fixture is why nap, absence and enrollment cases failed once: the questions were
//    real, the knowledge base under them was three entries

import { seedPolicies } from '../engine/src/server/store.js'
import type { Policy } from '../engine/src/types/knowledge.js'

export const APPROVED_FIXTURE: readonly Policy[] = seedPolicies()
