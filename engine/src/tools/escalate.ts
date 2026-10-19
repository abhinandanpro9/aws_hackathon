// The way out. Every other tool, and the model itself, can reach for this one.
// FLOW: model gives up -> topic -> the person who owns it -> a name and a number
// 1. this is the only tool that answers with no source, because it claims no fact
// 2. an unknown topic still routes to a real person, never to nobody
// 3. calling this is a correct outcome, not a failure -- an honest hand-off beats a guess

import { TOOL_DESCRIPTIONS } from '../config/tools.js'
import { readString } from './shared/args.js'
import { SENSITIVE_TOPIC_IDS, isSensitiveTopic } from './shared/sensitive.js'
import { describeOwner, ownerForTopic } from './shared/staff.js'
import type { RawToolArgs, Tool, ToolDeclaration, ToolResult } from '../types/tools.js'

const DECLARATION: ToolDeclaration = {
  name: 'escalate_to_person',
  description: TOOL_DESCRIPTIONS.escalate_to_person,
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description:
          'What this is about. Use one of the listed topics when it fits, so the question reaches the right person. Use "unknown" when none of them do.',
        enum: [...SENSITIVE_TOPIC_IDS, 'unknown'],
      },
      question: {
        type: 'string',
        description: "What the parent asked, passed on so the staff member has the context.",
      },
    },
    required: ['topic'],
  },
}

function execute(args: RawToolArgs): ToolResult {
  const topic = readString(args, 'topic') ?? 'unknown'
  const owner = ownerForTopic(topic)

  return {
    tool: 'escalate_to_person',
    outcome: 'needs_human',
    // Written for a phone screen: what happened, then who to call, on its own line. A number
    // buried mid-paragraph is the part a parent has to hunt for.
    answer: `Thank you for asking. This one is better answered by a person than by me, so I have passed it to **${owner.name}**, our ${owner.role}.

They will come back to you. If it is urgent, call ${owner.phone} ext. ${owner.ext} and they can help straight away.`,
    sourceId: null,
    citation: null,
    routeTo: describeOwner(owner),
    detail: {
      topic,
      ownerId: owner.id,
      question: readString(args, 'question') ?? null,
      // Marks the hand-off as one a person owns by design, so the operator view can tell it
      // apart from a tool that simply could not answer.
      reason: isSensitiveTopic(topic) ? 'sensitive_topic' : 'model_escalated',
    },
  }
}

export const escalateTool: Tool = { declaration: DECLARATION, execute }
