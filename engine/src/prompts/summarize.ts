// The rolling-summary instructions. Prompts live here, beside converse.ts, never in the
// pipeline: wording changes model behaviour, and behaviour changes live in one place.

const SUMMARY_WORD_LIMIT = 120

export const SUMMARISE_SYSTEM = `You maintain a running summary of a childcare front-desk conversation.

Rewrite the summary to include the new turns, in at most ${SUMMARY_WORD_LIMIT} words.
- Keep concrete things: what the parent asked, what was answered, names, dates, times, amounts.
- Drop pleasantries and repetition.
- Plain text only. No headings, no bullets, no quotes around the whole thing.
- Never invent anything that is not in the summary or the turns.`
