// Model choice and sampling. Swap providers or models here, never in the pipeline.
// FLOW: config -> GeminiClient -> LlmClient interface -> the loop
// Sampling lives in config/loop.ts with the loop's other knobs, so there is one place to tune it.
// Model id verified against Google's docs 2026-08-24; gemini-2.5-flash also valid.
//
// 3.6 rather than 3.7 [2026-08-27]: 3.7 returned 503 "experiencing high demand" on every
// call for hours, which ends a parent's turn on a phone number. 3.6 is the previous-gen
// workhorse -- same tool calling, same param rules (no temperature/top_p, thinkingLevel not
// thinkingBudget), separate capacity. Move back to 3.7 when its demand settles.

export const GEMINI_MODEL = 'gemini-3.6-flash'

/**
 * The models tried in order. The free daily limit is per model, so a 429 on one moves to the next.
 * Lite first: it has the largest free daily allowance. Override with env GEMINI_MODELS.
 */
export const DEFAULT_GEMINI_MODELS: readonly string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  GEMINI_MODEL,
]

/** "a, b ,c" -> ['a', 'b', 'c']; empty or missing -> the default list. */
export function parseModelList(value: string | undefined): readonly string[] {
  const models = (value ?? '').split(',').map((m) => m.trim()).filter((m) => m.length > 0)
  return models.length > 0 ? models : DEFAULT_GEMINI_MODELS
}

/** thinkingLevel exists from 3.6 on; older models reject it, so they get their default. */
export function takesThinkingLevel(model: string): boolean {
  const match = /gemini-(\d+)\.(\d+)/.exec(model)
  if (match === null) return false
  const major = Number(match[1])
  const minor = Number(match[2])
  return major > 3 || (major === 3 && minor >= 6)
}
