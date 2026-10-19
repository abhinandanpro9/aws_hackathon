// The six named agents, and how one answer becomes a list of their steps.
// FLOW: tool trace ("ran <tool>: <outcome>") -> owner of each tool -> AgentStep[] -> both UIs
// 1. the steps are read from the trace the pipeline already writes, so they never claim
//    something the run did not do
// 2. Ava always opens and closes; Max closes instead when a person now owns the question

export type AgentId = 'ava' | 'lena' | 'nora' | 'theo' | 'max' | 'quill'

export interface Agent {
  readonly id: AgentId
  readonly name: string
  readonly role: string
  readonly tool: string
  readonly color: string
}

export interface AgentStep {
  readonly agent: AgentId
  readonly action: string
  readonly tool?: string
  readonly handoffTo?: AgentId
  /** Offset from the start of the request. */
  readonly ms: number
}

export const AGENTS: readonly Agent[] = [
  { id: 'ava', name: 'Ava', role: 'Receptionist — greets, routes, words the answer', tool: 'the model loop', color: '#7c3aed' },
  { id: 'lena', name: 'Lena', role: 'Handbook keeper', tool: 'lookup_policy, get_center_facts', color: '#0ea5e9' },
  { id: 'nora', name: 'Nora', role: 'Health lead', tool: 'check_attendance', color: '#ef4444' },
  { id: 'theo', name: 'Theo', role: 'Enrollment & tours', tool: 'book_tour', color: '#f59e0b' },
  { id: 'max', name: 'Max', role: 'Escalation — hands off to a named person', tool: 'escalate_to_person', color: '#10b981' },
  { id: 'quill', name: 'Quill', role: 'Curator — drafts policies from gaps', tool: '/api/curator/draft', color: '#64748b' },
]

const TOOL_OWNER: Record<string, AgentId> = {
  lookup_policy: 'lena',
  get_center_facts: 'lena',
  check_attendance: 'nora',
  book_tour: 'theo',
  escalate_to_person: 'max',
}

/** The agent who owns a tool. A tool nobody owns stays with Ava. */
export function ownerOfTool(tool: string): AgentId {
  return TOOL_OWNER[tool] ?? 'ava'
}

const TOOL_ACTION: Record<string, string> = {
  lookup_policy: 'Looked up the handbook policy',
  get_center_facts: 'Checked the centre facts',
  check_attendance: 'Checked the illness rule',
  book_tour: 'Checked the tour calendar',
  escalate_to_person: 'Handed the question to a person',
}

function actionFor(tool: string, outcome: string): string {
  const base = TOOL_ACTION[tool] ?? `Ran ${tool}`
  if (outcome === 'needs_human') return `${base}: a person needs to take this`
  if (outcome === 'answered') return `${base}: found the answer`
  return `${base}: ${outcome.replace(/_/g, ' ')}`
}

/** "Name, role (phone ext. N)" -> name and role. Only the first person when several were routed. */
export function parseRouteTo(routeTo: string): { person: string; role: string } {
  const first = routeTo.split(' · ')[0] ?? routeTo
  const comma = first.indexOf(',')
  if (comma < 0) return { person: first.trim(), role: '' }
  const person = first.slice(0, comma).trim()
  const rest = first.slice(comma + 1)
  const paren = rest.indexOf('(')
  return { person, role: (paren < 0 ? rest : rest.slice(0, paren)).trim() }
}

export interface StepSource {
  readonly trace: readonly string[]
  readonly outcome: string
  readonly routeTo: string | null
  readonly metrics?: { readonly latencyMs: number }
}

const TRACE_TOOL_LINE = /^ran ([a-z_]+): ([a-z_]+)/

/**
 * One answer's trace, as the agents who did the work.
 * FLOW: ava reads -> one step per tool by its owner -> ava writes it, or max hands it off
 * ms is spread evenly across the run's latency: the trace has order but no per-step times.
 */
export function stepsFromTrace(source: StepSource): AgentStep[] {
  const calls: { tool: string; outcome: string }[] = []
  for (const line of source.trace) {
    const match = TRACE_TOOL_LINE.exec(line)
    if (match !== null) calls.push({ tool: match[1] as string, outcome: match[2] as string })
  }

  const escalated = source.outcome === 'sent_to_person' && source.routeTo !== null
  const total = Math.max(0, Math.round(source.metrics?.latencyMs ?? 0))
  const count = calls.length + 2
  const at = (index: number): number => (count <= 1 ? 0 : Math.round((total * index) / (count - 1)))

  const firstOwner = calls[0] === undefined ? undefined : ownerOfTool(calls[0].tool)
  const steps: AgentStep[] = [
    {
      agent: 'ava',
      action: 'Read the question',
      ...(firstOwner !== undefined && firstOwner !== 'ava'
        ? { handoffTo: firstOwner }
        : escalated && firstOwner === undefined
          ? { handoffTo: 'max' as const }
          : {}),
      ms: 0,
    },
  ]

  calls.forEach((call, index) => {
    const owner = ownerOfTool(call.tool)
    const next = calls[index + 1]
    const nextOwner = next === undefined ? (escalated ? 'max' : 'ava') : ownerOfTool(next.tool)
    steps.push({
      agent: owner,
      action: actionFor(call.tool, call.outcome),
      tool: call.tool,
      ...(nextOwner !== owner ? { handoffTo: nextOwner } : {}),
      ms: at(index + 1),
    })
  })

  if (escalated) {
    const { person, role } = parseRouteTo(source.routeTo as string)
    steps.push({
      agent: 'max',
      action: `Passed it to ${person}${role === '' ? '' : `, ${role}`}, and let them know`,
      ms: at(count - 1),
    })
  } else {
    steps.push({ agent: 'ava', action: 'Wrote the answer and checked every source', ms: at(count - 1) })
  }

  return steps
}
