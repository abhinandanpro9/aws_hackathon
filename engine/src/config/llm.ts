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
