// The crew over Agent2Agent (A2A) v1.0: one agent card and one JSON-RPC endpoint per agent.
// Spec: https://a2a-protocol.org/latest/specification/ (v1.0.0; method names in section 5.3,
// error codes in 5.4, agent card in 4.4, well-known path /.well-known/agent-card.json in 8)
// FLOW: SendMessage { message.parts: [text, data{skill,args}] } -> owner runs its tool -> Task
// 1. v1.0 shapes: no `kind` field, ROLE_* and TASK_STATE_* enum strings, camelCase fields
// 2. the 0.3 method name "message/send" is accepted too, so older clients still work
// 3. the tool still decides; A2A is the envelope, never a second rule

import { AGENTS } from '../lib/agents.js'
import type { Agent, AgentId } from '../lib/agents.js'
import { runTool } from '../tools/registry.js'
import type { Policy } from '../types/knowledge.js'
import type { RawToolArgs, ToolName, ToolResult } from '../types/tools.js'

export const A2A_PROTOCOL_VERSION = '1.0'
export const SEND_METHODS = ['SendMessage', 'message/send'] as const

export interface A2aPart {
  readonly text?: string
  readonly data?: unknown
  readonly mediaType?: string
}

export interface A2aMessage {
  readonly messageId: string
  readonly role: 'ROLE_USER' | 'ROLE_AGENT'
  readonly parts: readonly A2aPart[]
  readonly contextId?: string
  readonly taskId?: string
}

export interface A2aTask {
  readonly id: string
  readonly contextId: string
  readonly status: { readonly state: string; readonly timestamp: string; readonly message?: A2aMessage }
  readonly artifacts: readonly { readonly artifactId: string; readonly name: string; readonly parts: readonly A2aPart[] }[]
  readonly history: readonly A2aMessage[]
}

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0'
  readonly id: string | number | null
  readonly method: string
  readonly params?: { readonly message?: A2aMessage }
}

export type JsonRpcResponse =
  | { readonly jsonrpc: '2.0'; readonly id: string | number | null; readonly result: { readonly task: A2aTask } }
  | { readonly jsonrpc: '2.0'; readonly id: string | number | null; readonly error: { readonly code: number; readonly message: string } }

/** One delegation Ava made, for agents[] and the activity feed. */
export interface A2aHop {
  readonly agent: AgentId
  readonly tool: string
  readonly method: string
  readonly taskId: string
  readonly messageId: string
}

/** The skills each agent serves. Ava and Quill are reached over HTTP only (they need the model). */
export const AGENT_SKILLS: Record<AgentId, readonly { id: string; name: string; description: string; tags: string[] }[]> = {
  ava: [{ id: 'answer_question', name: 'Answer a parent question', description: 'Greets, routes to the specialist, words the answer with its source.', tags: ['reception', 'routing'] }],
  lena: [
    { id: 'lookup_policy', name: 'Look up a handbook policy', description: 'Finds the approved policy for a topic label.', tags: ['handbook', 'policy'] },
    { id: 'get_center_facts', name: 'Get centre facts', description: 'Hours, closures, tours and today\'s date from structured centre data.', tags: ['hours', 'closures'] },
  ],
  nora: [{ id: 'check_attendance', name: 'Check the illness rule', description: 'Decides in code whether a child must stay home, from symptoms and temperature.', tags: ['health', 'illness'] }],
  theo: [{ id: 'book_tour', name: 'Book a tour', description: 'Checks the tour calendar and books an open slot.', tags: ['enrollment', 'tours'] }],
  max: [
    { id: 'escalate_to_person', name: 'Hand off to a person', description: 'Routes the question to the named staff member who owns the topic.', tags: ['escalation'] },
    { id: 'hand_off', name: 'Take a hand-off', description: 'Takes over a question another agent\'s rule already routed, and passes it to the person that rule named.', tags: ['escalation', 'handoff'] },
  ],
  quill: [{ id: 'draft_policy', name: 'Draft a policy', description: 'Drafts one policy from an unanswered question, for a person to approve.', tags: ['curation'] }],
}

export function agentCard(agent: Agent, origin: string): Record<string, unknown> {
  return {
    name: agent.name,
    description: agent.role,
    supportedInterfaces: [{ url: `${origin}/a2a/${agent.id}`, protocolBinding: 'JSONRPC', protocolVersion: A2A_PROTOCOL_VERSION }],
    provider: { organization: 'Sunflower Grove Front Desk Crew', url: origin },
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: AGENT_SKILLS[agent.id].map((skill) => ({
      ...skill,
      inputModes: ['application/json'],
      outputModes: ['text/plain', 'application/json'],
    })),
  }
}

export function findAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id)
}

const randomId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`

export function rpcError(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/** A completed Task: a TextPart summary plus the full result as a DataPart. */
export function completedTask(request: A2aMessage, summary: string, data: unknown): A2aTask {
  const contextId = request.contextId ?? randomId('ctx')
  const id = randomId('task')
  const reply: A2aMessage = { messageId: randomId('msg'), role: 'ROLE_AGENT', parts: [{ text: summary }], contextId, taskId: id }
  return {
    id,
    contextId,
    status: { state: 'TASK_STATE_COMPLETED', timestamp: new Date().toISOString(), message: reply },
    artifacts: [{ artifactId: randomId('art'), name: 'result', parts: [{ text: summary }, { data, mediaType: 'application/json' }] }],
    history: [request],
  }
}

/** Basic JSON-RPC and SendMessage checks. Returns the message, or the error to send back. */
export function readSendMessage(body: unknown): { request: JsonRpcRequest; message: A2aMessage } | JsonRpcResponse {
  const request = body as JsonRpcRequest
  if (typeof request !== 'object' || request === null || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return rpcError(null, -32600, 'Invalid Request')
  }
  if (!(SEND_METHODS as readonly string[]).includes(request.method)) {
    return rpcError(request.id ?? null, -32601, `Method not found: ${request.method}`)
  }
  const message = request.params?.message
  if (message === undefined || !Array.isArray(message.parts) || typeof message.messageId !== 'string') {
    return rpcError(request.id ?? null, -32602, 'Invalid params: params.message with messageId and parts is required')
  }
  return { request, message }
}

export interface ToolRpcContext {
  readonly approved: readonly Policy[]
  readonly bookings: readonly { readonly date: string; readonly time: string }[]
}

/**
 * SendMessage to a tool-owning agent (Lena, Nora, Theo, Max).
 * The DataPart is { skill, args } or the args alone; the skill defaults to the agent's first.
 */
export function handleToolRpc(agentId: AgentId, body: unknown, context: ToolRpcContext): JsonRpcResponse {
  const read = readSendMessage(body)
  if ('jsonrpc' in read) return read
  const { request, message } = read

  const skills = AGENT_SKILLS[agentId].map((s) => s.id)
  const dataPart = message.parts.find((p) => p.data !== undefined && typeof p.data === 'object' && p.data !== null)
  const data = (dataPart?.data ?? {}) as { skill?: unknown; args?: unknown }
  const skill = typeof data.skill === 'string' ? data.skill : skills[0]
  if (skill === undefined || !skills.includes(skill) || skill === 'answer_question' || skill === 'draft_policy') {
    return rpcError(request.id ?? null, -32004, `${agentId} does not serve skill "${String(skill)}" here`)
  }
  const args = (typeof data.args === 'object' && data.args !== null ? data.args : data.skill === undefined ? data : {}) as RawToolArgs

  // A rule already chose the person; Max carries it out and never re-routes.
  if (skill === 'hand_off') {
    const routeTo = (args as Record<string, unknown>)['routeTo']
    if (typeof routeTo !== 'string' || routeTo.length === 0) {
      return rpcError(request.id ?? null, -32602, 'Invalid params: hand_off needs args.routeTo')
    }
    return { jsonrpc: '2.0', id: request.id ?? null, result: { task: completedTask(message, `Handed to ${routeTo}`, args) } }
  }

  const result: ToolResult = runTool(skill as ToolName, args, context.approved, { bookings: context.bookings })
  return { jsonrpc: '2.0', id: request.id ?? null, result: { task: completedTask(message, result.answer, result) } }
}

/** Same JSON-RPC payloads as HTTP, no network hop: a Worker cannot reliably fetch its own URL. */
export type A2aTransport = (agentId: AgentId, request: JsonRpcRequest, context: ToolRpcContext) => JsonRpcResponse

export const inProcessTransport: A2aTransport = (agentId, request, context) =>
  JSON.parse(JSON.stringify(handleToolRpc(agentId, JSON.parse(JSON.stringify(request)), context))) as JsonRpcResponse

/** Build Ava's SendMessage for one tool call. */
export function delegationRequest(tool: string, args: unknown, from = 'Ava'): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: randomId('rpc'),
    method: 'SendMessage',
    params: {
      message: {
        messageId: randomId('msg'),
        role: 'ROLE_USER',
        parts: [{ text: `${from} asks: run ${tool}` }, { data: { skill: tool, args }, mediaType: 'application/json' }],
      },
    },
  }
}

/** The ToolResult carried in a Task's DataPart, or null when the reply is not a usable Task. */
export function toolResultFrom(response: JsonRpcResponse): { task: A2aTask; result: ToolResult } | null {
  if (!('result' in response)) return null
  const task = response.result.task
  const data = task.artifacts[0]?.parts.find((p) => p.data !== undefined)?.data as ToolResult | undefined
  if (data === undefined || typeof data.tool !== 'string' || typeof data.outcome !== 'string') return null
  return { task, result: data }
}
