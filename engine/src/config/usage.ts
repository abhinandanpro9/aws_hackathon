// How much usage detail to keep per policy or topic.
// FLOW: recordPolicyUse -> capped at MAX_TRACKED_QUESTIONS -> operator's usage view
// 1. enough wording for an operator to judge whether a policy answers what it was written for
// 2. capped because one popular policy would otherwise grow without bound in memory
// 3. a real system would keep all of it in a database and sample here

/** Most recent parent questions kept per policy and per near-miss topic. */
export const MAX_TRACKED_QUESTIONS = 10
