// Reading what a model sent, without trusting it.
// FLOW: raw args -> read* -> a value, or a problem the tool turns into invalid_arguments
// 1. bounds catch a model hallucinating a number; they never clamp a parent's real one
// 2. a missing field is fine and returns undefined; a WRONG field is a refusal
// 3. nothing here throws, because a thrown error in a tool becomes a crash mid-answer

import { describeOwner, defaultOwner } from './staff.js'
import type { RawToolArgs, ToolName, ToolResult } from '../../types/tools.js'

export interface Bounds {
  readonly min: number
  readonly max: number
}

type Failure = { readonly ok: false; readonly problem: string }
type Success<T> = { readonly ok: true; readonly value: T }
export type Validated<T> = Success<T> | Failure

export function readNumber(args: RawToolArgs, key: string, bounds: Bounds): Validated<number | undefined> {
  const raw = args[key]
  if (raw === undefined || raw === null) return { ok: true, value: undefined }

  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return { ok: false, problem: `${key} must be a number` }
  }
  if (raw < bounds.min || raw > bounds.max) {
    return { ok: false, problem: `${key} of ${raw} is outside the range we can reason about` }
  }
  return { ok: true, value: raw }
}

export function readBoolean(args: RawToolArgs, key: string): Validated<boolean | undefined> {
  const raw = args[key]
  if (raw === undefined || raw === null) return { ok: true, value: undefined }
  if (typeof raw !== 'boolean') return { ok: false, problem: `${key} must be true or false` }
  return { ok: true, value: raw }
}

/** A non-empty string, or undefined. A wrong type here is treated as absent, not as a refusal. */
export function readString(args: RawToolArgs, key: string): string | undefined {
  const raw = args[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined
}

/** The one shape every tool uses when the model sent something it could not read. */
export function invalidArguments(tool: ToolName, problem: string): ToolResult {
  return {
    tool,
    outcome: 'invalid_arguments',
    answer: 'Sorry — I could not read that clearly enough to answer it safely, so I am passing it to a person who can.',
    sourceId: null,
    citation: null,
    routeTo: describeOwner(defaultOwner()),
    detail: { problem, decision: 'ask_a_human' },
  }
}

/**
 * A calendar date the tool can actually work with, or undefined.
 * FLOW: string -> YYYY-MM-DD shape -> a real day in a real month -> the date
 * 1. shape alone is not enough: 2026-02-30 and 2026-13-45 both match the pattern and are
 *    not days. Round-tripping through Date catches a rolled-over month.
 * 2. this exists because the ladder answers NO to "is it published" and NO to "is it a
 *    weekend" for nonsense, and then fell through to "we are open" -- a fabricated closure
 *    answer built from a string the model invented
 */
export function readDate(
  args: RawToolArgs,
  key: string,
): { readonly date?: string; readonly unreadable?: string } {
  const raw = readString(args, key)
  if (raw === undefined) return {}

  const value = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { unreadable: value }

  // Noon, so a timezone shift cannot move the day either side of midnight.
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return { unreadable: value }

  // A rolled-over date (Feb 30 -> Mar 2) formats back differently from what came in.
  const roundTrip = [
    parsed.getFullYear().toString().padStart(4, '0'),
    (parsed.getMonth() + 1).toString().padStart(2, '0'),
    parsed.getDate().toString().padStart(2, '0'),
  ].join('-')

  return roundTrip === value ? { date: value } : { unreadable: value }
}

/**
 * The tool needs one more thing before it can decide.
 * FLOW: tool -> needs_detail + what is missing -> the model asks the parent -> tool runs again
 * Not a failure and not a hand-off. `answer` states WHAT IS MISSING for the model to read;
 * the model does the asking in its own words, so the wording a parent sees is never
 * hardcoded here. No source id, because nothing has been decided yet.
 */
export function needsDetail(
  tool: ToolName,
  answer: string,
  detail: Readonly<Record<string, string | number | boolean | null>> = {},
): ToolResult {
  return {
    tool,
    outcome: 'needs_detail',
    answer,
    sourceId: null,
    citation: null,
    routeTo: null,
    detail,
  }
}

/** The one shape every tool uses when it will not answer and a person must. */
export function needsHuman(
  tool: ToolName,
  answer: string,
  detail: Readonly<Record<string, string | number | boolean | null>> = {},
): ToolResult {
  return {
    tool,
    outcome: 'needs_human',
    answer,
    sourceId: null,
    citation: null,
    routeTo: describeOwner(defaultOwner()),
    detail,
  }
}
