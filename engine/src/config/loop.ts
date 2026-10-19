// How far the model is allowed to go before a person takes over.
// FLOW: parent message -> up to MAX_MODEL_TURNS passes -> answer, or a hand-off
// 1. a bounded loop cannot spend forever on one question, however confused the model gets
// 2. hitting the bound is a HAND-OFF, never a best-effort answer from a half-finished loop
// 3. two turns answers almost everything: one to call a tool, one to say the result

/**
 * Model round-trips per parent message.
 * Four allows: call a tool, read it, call a second tool, answer. Beyond that the model is
 * not converging and a person should have it.
 */
export const MAX_MODEL_TURNS = 4

/** Turns of history the model sees. Enough for a clarifying exchange, not a whole history. */
export const MAX_HISTORY_TURNS = 10

/**
 * How hard the model may think before it replies.
 * FLOW: request -> thinkingConfig.thinkingLevel -> reasoning, then the answer
 * 1. it decides nothing here. Every verdict is computed in code and handed to it, so the
 *    thinking it was doing on the default level was spent re-deriving a decision it had
 *    already been given.
 * 2. low rather than none: it still has to classify an intent and fill a tool's arguments
 *    from ordinary words -- "last night" into hours, a symptom into the right field. The bet
 *    is that routing is recognition rather than reasoning.
 * 3. LOW | MEDIUM (default) | HIGH. Gemini 3.6+ replaced the old token budget with these;
 *    MINIMAL is rejected by 3.7. [2026-08-27]
 */
export const THINKING_LEVEL = 'LOW'

/**
 * Zero, for repeatability.
 * The model does not decide anything here -- a rule already did -- so the only thing warmth
 * buys is a different sentence each time. The same question asked twice should read the same
 * way: a parent comparing notes with another parent, or an operator reading the log, should
 * not see two different answers to one question and wonder which is right.
 */
export const CONVERSE_TEMPERATURE = 0
