// Reading what the model said, without trusting how it said it.
// FLOW: raw model text -> parseReply -> { text, citedSource } -> the loop checks the source
// 1. JSON is asked for because a missing FIELD is detectable, while a missing line is not:
//    prose that forgot its source line looks exactly like prose that claimed no fact
// 2. nothing here throws. A reply we cannot read is a value the guardrail then rejects,
//    because a crash mid-answer is worse than an answer that gets discarded
// 3. Gemini cannot combine a response schema with function calling, so the shape is asked
//    for in the instruction and validated here rather than enforced by the provider

export interface ParsedReply {
  readonly text: string
  /** Every id the model claims, comma-joined. Null when it claimed no fact. */
  readonly citedSource: string | null
}

/** Pull the first JSON object out of a reply, tolerating code fences and stray prose. */
function extractObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.replace(/```json/gi, '').replace(/```/g, '')
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  try {
    const parsed: unknown = JSON.parse(fenced.slice(start, end + 1))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function parseReply(raw: string): ParsedReply {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { text: '', citedSource: null }

  const parsed = extractObject(trimmed)

  // Not JSON at all. Show what it said, claim nothing: the guardrail then treats it as an
  // unsourced claim, which is the safe reading of a reply we could not verify.
  if (parsed === null) return { text: trimmed, citedSource: null }

  const answer = typeof parsed['answer'] === 'string' ? parsed['answer'].trim() : ''

  const rawSources = parsed['sources']
  const sources = Array.isArray(rawSources)
    ? rawSources.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : []

  return {
    text: answer,
    citedSource: sources.length === 0 ? null : sources.map((s) => s.trim()).join(', '),
  }
}
