// The real model, behind the one interface the pipeline knows about.
// FLOW: loop -> GeminiClient.converse -> @google/genai -> tool calls, or text plus a source
// 1. every response is parsed defensively; a malformed reply is a value, not a crash
// 2. nothing here decides anything -- it converses and reports which tools it wants
// 3. one method only, so there is no second entry point that could skip the tool loop
// WHY: swapping providers must never require touching the pipeline

import { FunctionCallingConfigMode, GoogleGenAI, type FunctionDeclaration, type ThinkingLevel } from '@google/genai'
import { DEFAULT_GEMINI_MODELS, parseModelList, takesThinkingLevel } from '../config/llm.js'
import { THINKING_LEVEL } from '../config/loop.js'
import { parseReply } from './reply.js'
import { LlmUnavailableError } from '../types/llm.js'
import type { ConverseRequest, ConverseResponse, LlmClient, ToolCall } from '../types/llm.js'
import type { ToolDeclaration } from '../types/tools.js'

/**
 * Our declarations are deeply readonly; the SDK's are mutable and use its own Schema type.
 * structuredClone drops the readonly-ness for real, so the cast describes what is already true.
 */
function toSdkDeclarations(declarations: readonly ToolDeclaration[]): FunctionDeclaration[] {
  return declarations.map(
    (declaration) =>
      ({
        name: declaration.name,
        description: declaration.description,
        parameters: structuredClone(declaration.parameters),
      }) as unknown as FunctionDeclaration,
  )
}

// Per isolate: a model that returned 429 is skipped until the wait Gemini named.
// A per-minute limit and a daily limit both come back as 429; skipping forever turned a
// one-minute burst into every model "exhausted" for the isolate's life.
const exhaustedUntil = new Map<string, number>()
let lastAnsweredBy: string | null = null
const DEFAULT_RETRY_MS = 60_000

/** For tests: forget which models were exhausted and which answered. */
export function resetModelState(): void {
  exhaustedUntil.clear()
  lastAnsweredBy = null
}

function isExhausted(model: string): boolean {
  const until = exhaustedUntil.get(model)
  return until !== undefined && Date.now() < until
}

/** "retry in 30.5s" / "retryDelay":"30s" / "7h34m56s" -> ms; unknown -> 60 s. */
function retryAfterMs(error: unknown): number {
  const text = error instanceof Error ? error.message : String(error)
  const match = /retry(?:Delay)?\W+(?:in\s+)?((?:\d+h)?(?:\d+m)?[\d.]+s)/i.exec(text)
  if (match === null) return DEFAULT_RETRY_MS
  const parts = /(?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/.exec(match[1] as string)
  if (parts === null) return DEFAULT_RETRY_MS
  const ms = (Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3])) * 1000
  return Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_RETRY_MS
}

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown }).status
  if (typeof status === 'number') return status
  const text = error instanceof Error ? error.message : String(error)
  if (/RESOURCE_EXHAUSTED|"code":\s*429/.test(text)) return 429
  if (/UNAVAILABLE|"code":\s*503/.test(text)) return 503
  return null
}

export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI
  private readonly models: readonly string[]

  constructor(apiKey: string, models: readonly string[] = DEFAULT_GEMINI_MODELS) {
    if (apiKey.trim().length === 0) {
      throw new LlmUnavailableError('No Gemini API key was provided.')
    }
    this.ai = new GoogleGenAI({ apiKey })
    this.models = models.length > 0 ? models : DEFAULT_GEMINI_MODELS
  }

  /** The model that answered last, or the one that will be tried first. */
  get name(): string {
    return lastAnsweredBy ?? this.models.find((m) => !isExhausted(m)) ?? this.models[0] ?? 'gemini'
  }

  /**
   * The same request down the model list.
   * FLOW: next unexhausted model -> 429 ? remember + next : 503 ? next : any other error -> throw
   */
  async converse(request: ConverseRequest): Promise<ConverseResponse> {
    let lastError: unknown = null
    for (const model of this.models) {
      if (isExhausted(model)) continue
      try {
        const reply = await this.converseOn(model, request)
        lastAnsweredBy = model
        return reply
      } catch (error: unknown) {
        const reason = (error as { reason?: unknown }).reason ?? error
        const status = statusOf(reason)
        if (status === 429) exhaustedUntil.set(model, Date.now() + retryAfterMs(reason))
        if (status !== 429 && status !== 503) throw error
        lastError = error
      }
    }
    throw lastError ?? new LlmUnavailableError('Every Gemini model is exhausted.')
  }


  /**
   * One conversational turn, with tools the model may ask for.
   * FLOW: turns -> Gemini contents -> reply -> function calls, or text plus a cited source
   * The source is asked for as a trailing line rather than a tool, because a model that
   * forgets a tool call is silent, while a model that forgets a line is visibly missing it.
   */
  private async converseOn(model: string, request: ConverseRequest): Promise<ConverseResponse> {
    const declarations = request.tools as readonly ToolDeclaration[]

    const contents = request.turns.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text:
            turn.role === 'tool'
              ? `Result from ${turn.toolName ?? 'a tool'}:\n${turn.text}`
              : turn.text,
        },
      ],
    }))

    // Asked for as JSON so a missing source is a missing FIELD, which is detectable.
    // A prose reply that forgot its source line looks exactly like one that claimed no fact.
    const raw = request.format === 'raw'
    const instruction = raw ? request.system : `${request.system}

REPLY FORMAT (this is not optional):
Reply with a single JSON object and nothing else, in exactly this shape:
{"answer": "<what you say to the parent>", "sources": ["<source id>", ...]}

- "answer" is the words the parent reads. Keep it warm and short.
- "sources" lists the id of EVERY tool result your answer rests on, exactly as the tool
  gave it to you. Two tools means two ids.
- "sources" is an empty list when you are not stating a fact, such as a greeting.
- No code fences, no text before or after the object.`

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: instruction,
          // Gemini 3.6+ dropped temperature/top_p/top_k and replaced thinkingBudget with a
          // level, so both were removed here.
          // FLOW: config -> generateContent -> tool calls, or text plus a source
          // 1. LOW is the level THINKING_BUDGET_TOKENS was reaching for: enough to fill a
          //    tool's arguments from ordinary words, not enough to re-derive a decided verdict
          ...(takesThinkingLevel(model) ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL as ThinkingLevel } } : {}),
          ...(declarations.length === 0
            ? {}
            : { tools: [{ functionDeclarations: toSdkDeclarations(declarations) }] }),
          // Code picks the first tool for some questions; the model still fills its arguments.
          ...(request.forceTool === undefined || declarations.length === 0
            ? {}
            : {
                toolConfig: {
                  functionCallingConfig: {
                    mode: FunctionCallingConfigMode.ANY,
                    allowedFunctionNames: [request.forceTool],
                  },
                },
              }),
        },
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []

      const toolCalls: ToolCall[] = parts.flatMap((part) =>
        part.functionCall?.name === undefined
          ? []
          : [{ name: part.functionCall.name, args: part.functionCall.args ?? {} }],
      )

      const rawText = parts
        .map((part) => part.text ?? '')
        .join('')
        .trim()

      const { text, citedSource } = raw ? { text: rawText, citedSource: null } : parseReply(rawText)

      // Reported per call, so a multi-turn tool loop adds up across its passes.
      const meta = response.usageMetadata
      const usage =
        meta === undefined
          ? undefined
          : {
              inputTokens: meta.promptTokenCount ?? 0,
              outputTokens: meta.candidatesTokenCount ?? 0,
            }

      return { text, toolCalls, citedSource, ...(usage === undefined ? {} : { usage }) }
    } catch (error: unknown) {
      throw new LlmUnavailableError('Gemini call failed.', error)
    }
  }
}

/**
 * Build a client from the environment, or return null when no key is configured.
 * FLOW: Worker passes env.GEMINI_API_KEY -> used directly · Node passes nothing -> process.env
 * Workers hand bindings to the request, not the process, so the key arrives as an argument
 * there. Node keeps the old zero-argument call.
 */
export function geminiFromEnv(apiKey?: string, models?: string): GeminiClient | null {
  const key = apiKey ?? process.env['GEMINI_API_KEY']
  if (key === undefined || key.trim().length === 0) return null
  // The placeholder from .env.example is not a key. Treating it as one reports the model as
  // configured and then fails at the first question, which sends the reader hunting the
  // wrong bug -- say "not configured" instead, which is the truth and names the fix.
  if (key.trim() === 'your-key-here') return null
  return new GeminiClient(key, parseModelList(models ?? process.env['GEMINI_MODELS']))
}
