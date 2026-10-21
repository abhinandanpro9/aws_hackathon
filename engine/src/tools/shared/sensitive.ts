// The topics no tool will answer, whoever asks and however confident the model is.
// FLOW: model calls a tool -> tool asks refuseIfSensitive -> a person, or carry on
// 1. this is a TOOL-LAYER guard, not a filter on the message: the model may read anything
// 2. a model that forgets to escalate still cannot get an answer out, because the tool refuses
// 3. the list is center.json, so a center adds a sensitive topic without a code change
// WHY: guardrails belong where the action happens, the way a refund tool re-checks eligibility

import centerData from '../../../data/center.json' with { type: 'json' }
import { describeOwner, ownerForTopic } from './staff.js'
import type { ToolName, ToolResult } from '../../types/tools.js'

interface SensitiveTopic {
  readonly id: string
  readonly description: string
  readonly route_to: string
}

const TOPICS: readonly SensitiveTopic[] = centerData.sensitive_topics.topics

/** The sensitive topic ids, for a tool that takes a topic argument. */
export const SENSITIVE_TOPIC_IDS: readonly string[] = TOPICS.map((topic) => topic.id)

/** True when this is a topic only a person may answer. */
export function isSensitiveTopic(topic: string): boolean {
  return SENSITIVE_TOPIC_IDS.includes(topic)
}

/**
 * The refusal every tool returns for a sensitive topic.
 * Named person, real number, and no attempt at the underlying question.
 */
export function refuseAsSensitive(tool: ToolName, topic: string): ToolResult {
  const owner = ownerForTopic(topic)

  return {
    tool,
    outcome: 'needs_human',
    answer: `Thank you for telling me. This is something a person should handle with you, so I have passed it to **${owner.name}**, our ${owner.role}.

They will be in touch. If it is urgent, call ${owner.phone} ext. ${owner.ext}.`,
    sourceId: null,
    citation: null,
    routeTo: describeOwner(owner),
    detail: { topic, reason: 'sensitive_topic', decision: 'ask_a_human' },
  }
}
