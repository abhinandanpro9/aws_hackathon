// Reading an approved policy back to a parent, and proving where it came from.
// FLOW: model picks a label -> matching policies searched -> the answer and its id@version
// 1. the id and version ARE the source the model must cite; it cannot cite what it was never handed
// 2. the policy list is passed in, never imported, because it changes as operators approve
// 3. a label with nothing approved is an honest gap, and a gap is a real answer here
// 4. sensitivity lives on the policy record, so a model that skips escalate_to_person is
//    still refused here rather than reading a sensitive answer out

import { TOOL_DESCRIPTIONS } from '../config/tools.js'
import { needsHuman, readString } from './shared/args.js'
import { refuseAsSensitive } from './shared/sensitive.js'
import type { Policy } from '../types/knowledge.js'
import type { RawToolArgs, ToolDeclaration, ToolResult } from '../types/tools.js'

/**
 * A tool that reads the approved list. Kept separate from the plain Tool shape because
 * this is the only tool whose answer depends on state an operator changes at runtime.
 */
export interface PolicyTool {
  readonly declaration: (approved: readonly Policy[]) => ToolDeclaration
  readonly execute: (args: RawToolArgs, approved: readonly Policy[]) => ToolResult
}

/** Every label an approved policy actually carries, so the model is never offered a dead one. */
function labelsOf(approved: readonly Policy[]): readonly string[] {
  return [...new Set(approved.flatMap((policy) => policy.labels))].sort()
}

/**
 * Only labels that actually have an approved policy are offered.
 * A model cannot ask for a policy that does not exist if it is never shown one, and an
 * operator adding a policy adds its routing at the same time.
 */
function declaration(approved: readonly Policy[]): ToolDeclaration {
  return {
    name: 'lookup_policy',
    description: TOOL_DESCRIPTIONS.lookup_policy,
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description:
            'Which policy to read. Only these labels have an approved answer; anything else has to go to a person.',
          enum: labelsOf(approved),
        },
      },
      required: ['label'],
    },
  }
}

function execute(args: RawToolArgs, approved: readonly Policy[]): ToolResult {
  const label = readString(args, 'label')

  if (label === undefined) {
    return needsHuman('lookup_policy', 'I am not sure which policy you mean, so a person will pick this up.')
  }

  const policy = approved.find((candidate) => candidate.labels.includes(label))

  if (policy === undefined) {
    return needsHuman(
      'lookup_policy',
      'I do not have anything approved about that yet, so I would rather a person answered it.',
      { label, reason: 'no_approved_entry' },
    )
  }

  // The guard sits on the record, not on the message: a model that skipped
  // escalate_to_person still cannot read out an answer only a person may give.
  if (policy.sensitive) return refuseAsSensitive('lookup_policy', label)

  return {
    tool: 'lookup_policy',
    outcome: 'answered',
    answer: policy.text,
    // id@version, so the citation pins the exact wording that was read. An operator
    // editing this policy mid-conversation invalidates the citation rather than
    // silently letting a parent read words that are no longer approved.
    sourceId: `${policy.id}@${policy.version}`,
    citation: policy.reference,
    routeTo: null,
    detail: { label, policyId: policy.id, version: policy.version, approvedBy: policy.approvedBy },
  }
}

export const lookupPolicyTool: PolicyTool = { declaration, execute }
