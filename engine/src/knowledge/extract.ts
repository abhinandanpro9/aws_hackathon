// Pasted handbook text becomes policy DRAFTS for the approval queue, never live answers.
// FLOW: pasted text -> model structures it -> THIS validates every item -> propose as pending
// 1. the model reads and structures; code decides what counts as a usable draft
// 2. a malformed item is dropped, not repaired: an invented policy is worse than a missing one
// 3. capped both ways -- input words and output drafts -- so one paste cannot flood the queue

/** The paste size both the UI and the server refuse beyond. */
export const EXTRACT_WORD_LIMIT = 6000

/** The most drafts one extraction may produce. A queue of fifty is not reviewable. */
export const EXTRACT_DRAFT_CAP = 25

export interface ExtractedDraft {
  readonly text: string
  readonly labels: readonly string[]
  readonly sensitive: boolean
  readonly reference: string
}

/** JSON, possibly wrapped in code fences or prose. Null when no array can be read. */
function readArray(raw: string): readonly unknown[] | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Every valid draft in the model's reply, dropped-not-repaired, capped. */
export function draftsFromModelReply(raw: string): readonly ExtractedDraft[] {
  const items = readArray(raw) ?? []

  const drafts: ExtractedDraft[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>

    const text = typeof record['text'] === 'string' ? record['text'].trim() : ''
    const reference = typeof record['reference'] === 'string' ? record['reference'].trim() : ''
    const labels = Array.isArray(record['labels'])
      ? record['labels']
          .filter((label): label is string => typeof label === 'string')
          .map((label) => label.trim().toLowerCase())
          .filter((label) => label.length > 0)
      : []

    if (text.length === 0 || reference.length === 0 || labels.length === 0) continue

    drafts.push({
      text,
      labels,
      sensitive: record['sensitive'] === true,
      reference,
    })
    if (drafts.length >= EXTRACT_DRAFT_CAP) break
  }

  return drafts
}
