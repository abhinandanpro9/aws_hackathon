// The airlock: every tool the model may reach, and the only way to run one.
// FLOW: declarations -> model picks a name + args -> runTool -> the tool's own rule -> result
// 1. adding a tool means adding a file and one line here, never editing a shared body
// 2. an unknown tool name is a routing failure that names a person, not a crash
// 3. lookup_policy is passed the approved list, because that changes as operators approve
// WHY: a model that can talk its way past a sick-child rule is what this file exists to stop

import { bookTourTool } from './book-tour.js'
import { checkAttendanceTool } from './check-attendance.js'
import { getCenterFactsTool } from './get-center-facts.js'
import { escalateTool } from './escalate.js'
import { lookupPolicyTool } from './lookup-policy.js'
import { describeOwner, defaultOwner } from './shared/staff.js'
import centerData from '../../data/center.json' with { type: 'json' }
import type { Policy } from '../types/knowledge.js'
import type { RawToolArgs, Tool, ToolContext, ToolDeclaration, ToolName, ToolResult } from '../types/tools.js'

/** Every tool whose answer does not depend on operator-approved state. */
const TOOLS: Readonly<Record<string, Tool>> = {
  get_center_facts: getCenterFactsTool,
  check_attendance: checkAttendanceTool,
  book_tour: bookTourTool,
  escalate_to_person: escalateTool,
}

/** What the model reads when choosing a tool. Policy topics depend on what is approved. */
export function getDeclarations(approved: readonly Policy[]): readonly ToolDeclaration[] {
  return [lookupPolicyTool.declaration(approved), ...Object.values(TOOLS).map((tool) => tool.declaration)]
}

/** Run a tool by name. An unknown name is a routing failure, not a crash. */
export function runTool(
  name: ToolName,
  args: RawToolArgs,
  approved: readonly Policy[],
  context?: ToolContext,
): ToolResult {
  if (name === 'lookup_policy') return lookupPolicyTool.execute(args, approved)

  const tool = TOOLS[name]
  if (tool === undefined) {
    return {
      tool: 'escalate_to_person',
      outcome: 'needs_human',
      answer: 'Sorry, I could not find the right way to answer that. A person will pick it up for you.',
      sourceId: null,
      citation: null,
      routeTo: describeOwner(defaultOwner()),
      detail: { requestedTool: name },
    }
  }

  try {
    return tool.execute(args, context)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown failure'
    return {
      tool: name,
      outcome: 'invalid_arguments',
      answer: 'Sorry — I could not read that clearly enough to answer it safely, so I am passing it to a person who can.',
      sourceId: null,
      citation: null,
      routeTo: describeOwner(defaultOwner()),
      detail: { problem: message, decision: 'ask_a_human' },
    }
  }
}

/**
 * Whether a cited source is one a tool could have handed out, right now.
 * FLOW: model cites id@version -> split -> the live policy must match BOTH
 * 1. structured facts and rule verdicts are addressed by name; their data is read live
 * 2. a policy must match the version too, because the words behind an id can change
 * 3. a stale version is refused exactly like an id that never existed
 */

/**
 * Every source id this system can hand out, built from the centre's own data.
 * FLOW: center.json -> the four structured blocks + one id per illness criterion
 * A policy id is checked separately, against its exact version, because those change.
 */
const CENTER_SOURCE_IDS: ReadonlySet<string> = new Set([
  'center:hours',
  'center:closures',
  'center:tours',
  'center:today',
  'center:about',
])

const RULE_SOURCE_IDS: ReadonlySet<string> = new Set([
  // The rule cites the criterion that decided it, and "none" when nothing matched.
  'rule:attendance:none',
  ...centerData.illness.exclusion_criteria.map((c) => `rule:attendance:${c.id}`),
])

export function isKnownSource(sourceId: string, approved: readonly Policy[]): boolean {
  // Enumerated, not pattern matched. "starts with center:" accepted center:pricing and
  // center: itself, which are exactly the shapes an invented id takes.
  if (CENTER_SOURCE_IDS.has(sourceId)) return true
  if (RULE_SOURCE_IDS.has(sourceId)) return true

  const at = sourceId.lastIndexOf('@')
  if (at <= 0) return false

  const id = sourceId.slice(0, at)
  const version = Number(sourceId.slice(at + 1))
  if (!Number.isInteger(version)) return false

  return approved.some((entry) => entry.id === id && entry.version === version)
}
