// The real model, behind the one interface the pipeline knows about.
// FLOW: loop -> GeminiClient.converse -> @google/genai -> tool calls, or text plus a source
// 1. every response is parsed defensively; a malformed reply is a value, not a crash
// 2. nothing here decides anything -- it converses and reports which tools it wants
// 3. one method only, so there is no second entry point that could skip the tool loop
// WHY: swapping providers must never require touching the pipeline

import { GoogleGenAI, type FunctionDeclaration, type ThinkingLevel } from '@google/genai'
import { GEMINI_MODEL } from '../config/llm.js'
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

export class GeminiClient implements LlmClient {
  readonly name = GEMINI_MODEL
  private readonly ai: GoogleGenAI

  constructor(apiKey: string) {
    if (apiKey.trim().length === 0) {
      throw new LlmUnavailableError('No Gemini API key was provided.')
    }
    this.ai = new GoogleGenAI({ apiKey })
  }


  /**
   * One conversational turn, with tools the model may ask for.
   * FLOW: turns -> Gemini contents -> reply -> function calls, or text plus a cited source
   * The source is asked for as a trailing line rather than a tool, because a model that
   * forgets a tool call is silent, while a model that forgets a line is visibly missing it.
   */
  async converse(request: ConverseRequest): Promise<ConverseResponse> {
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
    const instruction = `${request.system}

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
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: instruction,
          // Gemini 3.6+ dropped temperature/top_p/top_k and replaced thinkingBudget with a
          // level, so both were removed here.
          // FLOW: config -> generateContent -> tool calls, or text plus a source
          // 1. LOW is the level THINKING_BUDGET_TOKENS was reaching for: enough to fill a
          //    tool's arguments from ordinary words, not enough to re-derive a decided verdict
          thinkingConfig: { thinkingLevel: THINKING_LEVEL as ThinkingLevel },
          tools: [{ functionDeclarations: toSdkDeclarations(declarations) }],
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

      const { text, citedSource } = parseReply(rawText)

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
export function geminiFromEnv(apiKey?: string): GeminiClient | null {
  const key = apiKey ?? process.env['GEMINI_API_KEY']
  if (key === undefined || key.trim().length === 0) return null
  // The placeholder from .env.example is not a key. Treating it as one reports the model as
  // configured and then fails at the first question, which sends the reader hunting the
  // wrong bug -- say "not configured" instead, which is the truth and names the fix.
  if (key.trim() === 'your-key-here') return null
  return new GeminiClient(key)
}
