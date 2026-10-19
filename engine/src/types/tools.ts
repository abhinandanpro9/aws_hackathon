// Tool types. What a model is allowed to call, and what it gets back.
// FLOW: declarations -> model picks a tool + args -> validate -> rule decides -> ToolResult
// 1. the model chooses and fills; the tool decides. That split is the safety design.
// 2. bad or partial args degrade to a safe result, they never throw and never default
// 3. every answered result carries a sourceId, and the model must cite one it was handed

export const TOOL_NAMES = [
  'lookup_policy',
  'get_center_facts',
  'check_attendance',
  'book_tour',
  'escalate_to_person',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

/** JSON-Schema-shaped parameter description, the subset Gemini and OpenAI both accept. */
export interface ToolParameterSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, ToolPropertySchema>>
  readonly required?: readonly string[]
}

export interface ToolPropertySchema {
  readonly type: 'string' | 'number' | 'boolean'
  readonly description: string
  readonly enum?: readonly string[]
}

/** What the model reads when deciding which tool to call. */
export interface ToolDeclaration {
  readonly name: ToolName
  /** Plain-English description. This is the model's only guide, so it is part of the contract. */
  readonly description: string
  readonly parameters: ToolParameterSchema
}

/**
 * Whether a tool call produced an answer, or a reason it could not.
 * `needs_detail` is not a failure: it is the tool asking one question back rather than
 * averaging several possible answers into a wrong one.
 */
export const TOOL_OUTCOMES = ['answered', 'needs_detail', 'needs_human', 'invalid_arguments'] as const
export type ToolOutcome = (typeof TOOL_OUTCOMES)[number]

/**
 * A source the model is allowed to cite. Handed out by a tool, never invented.
 * Three kinds exist: an approved policy id, a block of center data, or a rule verdict.
 * FLOW: tool answers -> sourceId travels with the answer -> model echoes it -> code checks it
 */
export type SourceId = string

/** What a tool hands back. The model may phrase this; it may not contradict it. */
export interface ToolResult {
  readonly tool: ToolName
  readonly outcome: ToolOutcome
  /** The decided answer in plain words. The model rewords, never overrides. */
  readonly answer: string
  /** What the model must cite to use this answer. Null when the tool claims no fact. */
  readonly sourceId: SourceId | null
  readonly citation: string | null
  /** Named person to route to, when a human is needed. */
  readonly routeTo: string | null
  /** Machine-readable detail for logging and the operator view. */
  readonly detail: Readonly<Record<string, string | number | boolean | null>>
}

/** Raw arguments as the model supplied them, before validation. */
export type RawToolArgs = Readonly<Record<string, unknown>>

/** A tool the model can call: what it looks like, and what it does. */
/** Request-scoped state a tool may read. Loaded once per message, never fetched in a tool. */
export interface ToolContext {
  readonly bookings: readonly { readonly date: string; readonly time: string }[]
}

export interface Tool {
  readonly declaration: ToolDeclaration
  readonly execute: (args: RawToolArgs, context?: ToolContext) => ToolResult
}
