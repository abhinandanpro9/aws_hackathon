// The one place this service writes a log line.
// FLOW: caller -> Logger.<level>(event, fields) -> one JSON line -> stdout / wrangler tail
// 1. structured, not prose: a line is greppable by event name and filterable by level
// 2. one line per event -- multi-line output interleaves badly across concurrent requests
// 3. NEVER logs a parent's question text or an answer: a log is not a place for family data
// WHY: on Workers a swallowed error is invisible. Without this, a failed D1 write returns a
// tidy JSON error to the UI and leaves nothing behind to debug from.

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/** Below this is dropped. Debug is opt-in so a normal deploy is not noisy. */
let minLevel: LogLevel = 'info'

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

/** What a log line may carry. Values are scalars so a line never nests. */
export type LogFields = Record<string, string | number | boolean | null | undefined>

/**
 * Turn an unknown thrown value into something a log line can hold.
 * A raw Error does not survive JSON.stringify -- message and stack both vanish.
 */
function describeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack?.split('\n').slice(0, 4).join(' | '),
    }
  }
  return { error: String(error) }
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return

  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  })

  // The one sanctioned console call in the codebase: this IS the log sink.
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const Logger = {
  debug: (event: string, fields: LogFields = {}): void => emit('debug', event, fields),
  info: (event: string, fields: LogFields = {}): void => emit('info', event, fields),
  warn: (event: string, fields: LogFields = {}): void => emit('warn', event, fields),

  /**
   * An error line always carries the cause.
   * FLOW: catch -> Logger.error(event, cause, fields) -> message + name + first stack frames
   */
  error: (event: string, cause?: unknown, fields: LogFields = {}): void =>
    emit('error', event, { ...fields, ...(cause === undefined ? {} : describeError(cause)) }),
} as const
