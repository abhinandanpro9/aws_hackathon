// Tells a person a question is waiting for them, through an n8n webhook.
// FLOW: escalation -> URL set ? POST (3 s cap, in the background) : fallback -> channel
// 1. never blocks the answer and never throws: the parent already has a name and a number
// 2. a missing URL is a normal state, reported as 'fallback' rather than an error

import { Logger } from './logger.js'

export interface EscalationEvent {
  readonly event: 'escalation'
  readonly person: string
  readonly role: string
  readonly question: string
  readonly sessionId: string | null
  readonly at: string
}

export interface Notified {
  readonly channel: 'n8n' | 'fallback'
  readonly to: string
}

export const NOTIFY_TIMEOUT_MS = 3000

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>

/**
 * Start the webhook call and hand back the promise for waitUntil.
 * The promise always resolves; a failure is logged, never raised.
 */
export function notifyEscalation(
  url: string | undefined,
  payload: EscalationEvent,
  fetchImpl: FetchLike = fetch,
): { notified: Notified; pending: Promise<void> } {
  if (url === undefined || url.trim().length === 0) {
    return { notified: { channel: 'fallback', to: payload.person }, pending: Promise.resolve() }
  }

  let pending: Promise<void>
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS)
    pending = fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) Logger.info('notify_failed', { status: response.status })
      })
      .catch((error: unknown) => Logger.error('notify_failed', error, {}))
      .finally(() => clearTimeout(timer))
  } catch (error: unknown) {
    Logger.error('notify_failed', error, {})
    return { notified: { channel: 'fallback', to: payload.person }, pending: Promise.resolve() }
  }

  return { notified: { channel: 'n8n', to: payload.person }, pending }
}
