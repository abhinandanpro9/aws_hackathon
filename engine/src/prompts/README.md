# Prompts

Every instruction the model receives lives here, one file per job. Nothing in `config/` holds
prompt text — config is for numbers and switches an operator would change, prompts are the words
the model reads.

## Shape

Each prompt follows the structure that worked in `support-agent-eval`:

1. **Role** — who the model is, on which channel, at what point in the conversation
2. **Your job** — the one sentence that says what it is deciding
3. **Routing** — the explicit branches, in order, with what happens in each
4. **Worked examples** — real input, real output, for the cases that get it wrong
5. **Guardrails** — stated last, marked as overriding everything above

Guardrails go last because that is where models weight hardest, and they are written as
prohibitions rather than preferences.

## Files

| File | Used by | Job |
|---|---|---|
| `classify.ts` | `pipeline/answer.ts` | Sort a parent's question into one topic |
| `extract-symptoms.ts` | `pipeline/answer.ts` | Read symptoms out of a message, decide nothing |
| `phrase.ts` | `pipeline/answer.ts` | Reword a decided answer, change nothing |
| `label-passage.ts` | `knowledge/label.ts` | Say which policy topic a handbook passage is |

## Rule

A prompt change is a behaviour change. Run `npm run eval` after touching any of these — the
harness exists to catch exactly this.
