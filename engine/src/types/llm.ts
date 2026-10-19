// The seam between our code and whatever model is behind it.
// FLOW: pipeline -> LlmClient -> (Gemini in production, a fake in tests)
// 1. nothing above this interface knows which provider is in use
// 2. every call has a typed result, so a malformed model reply is a value we handle, not a crash
// 3. tests inject a fake, so the suite never touches the network

// ─── Conversation ───

/** One turn of a conversation, as the model needs to see it. */
export interface Turn {
  readonly role: 'parent' | 'assistant' | 'tool'
  readonly text: string
  /** Set on a tool turn, so the model knows which call it is reading the result of. */
  readonly toolName?: string
}

/** The model asking to run a tool. It supplies the name and the form; the tool decides. */
export interface ToolCall {
  readonly name: string
  readonly args: Readonly<Record<string, unknown>>
}

export interface ConverseRequest {
  readonly system: string
  readonly turns: readonly Turn[]
  /** The tools the model may call this turn, in the provider's declaration shape. */
  readonly tools: readonly unknown[]
  readonly temperature?: number
}

/**
 * What the model said, and what it wants to run.
 * A reply with tool calls is a request, not an answer. A reply with none is the answer.
 */
export interface ConverseResponse {
  readonly text: string
  readonly toolCalls: readonly ToolCall[]
  /**
   * The source the model claims its answer came from. Code checks this against the ids
   * tools actually handed out; an invented one is discarded and the question escalates.
   */
  readonly citedSource: string | null
  /**
   * What this call cost, in tokens. Absent when the provider did not report it.
   * The eval turns this into money and into a per-question figure; without it, "would this
   * scale to thousands of centres" has no number behind it.
   */
  readonly usage?: TokenUsage
}

/** Tokens in and out for one model call. */
export interface TokenUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}

/**
 * Everything the pipeline may ask a model to do: exactly one thing.
 * The model converses and asks for tools; it never decides an outcome, and it never
 * gets a second entry point that could bypass the tool loop.
 */
export interface LlmClient {
  readonly name: string
  converse: (request: ConverseRequest) => Promise<ConverseResponse>
}

/** Raised when a provider is unreachable or returns something unusable. */
export class LlmUnavailableError extends Error {
  constructor(message: string, readonly reason?: unknown) {
    super(message)
    this.name = 'LlmUnavailableError'
  }
}
