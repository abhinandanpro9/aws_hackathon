// The API the control panel and the parent UI both talk to.
// FLOW: HTTP -> route -> engine (pipeline / rules) -> D1 -> JSON
// 1. no auth: this is a prototype, and saying so is better than faking it
// 2. every answer is recorded, because the operator view IS the improvement loop
// 3. the server owns no logic -- it is a thin shell over the engine
// 4. state is reached through c.env.DB, never a module-level object: on Workers that object
//    is per-isolate, so an approval could vanish between two requests

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import centerData from '../../data/center.json' with { type: 'json' }
import { APPROVAL_POLICY, needsApproval } from '../config/approvals.js'
import { applyChange, proposeChange, rejectChange, validateProposal } from '../knowledge/changes.js'
import { geminiFromEnv } from '../llm/gemini.js'
import { answerQuestion } from '../pipeline/answer.js'
import { EXTRACT_WORD_LIMIT, draftsFromModelReply } from '../knowledge/extract.js'
import { EXTRACT_SYSTEM } from '../prompts/extract.js'
import { summariseHistory } from '../pipeline/summarize.js'
import { MAX_HISTORY_TURNS } from '../config/loop.js'
import {
  addBooking,
  addChange,
  commitApproval,
  findChange,
  getApproved,
  getBookings,
  recordVisit,
  getSessionSummary,
  saveSessionSummary,
  getChanges,
  getConversations,
  getHistoryFor,
  recordConversation,
  replaceChange,
  resetAll,
  seedIfEmpty,
  setApproved,
} from './db.js'
import {
  getFeedbackSummary,
  getUsage,
  recordFeedback,
  recordNearMiss,
  recordPolicyUse,
} from './db-usage.js'
import { answeredThisWeek } from './stats.js'
import { threadsFrom } from './threads.js'
import { Logger } from '../lib/logger.js'
import { AGENTS, parseRouteTo, stepsFromTrace } from '../lib/agents.js'
import { notifyEscalation } from '../lib/notify.js'
import type { Notified } from '../lib/notify.js'
import { CURATOR_SYSTEM } from '../prompts/curator.js'
import { getActivity, recordActivity } from './db.js'
import type { D1Like } from './db.js'
import type { Context } from 'hono'
import type { AnswerRoute } from '../types/answer.js'
import type { ChangeKind, ProposeChangeInput } from '../types/changes.js'

export interface Env {
  DB: D1Like
  GEMINI_API_KEY?: string
  N8N_WEBHOOK_URL?: string
  SPONSOR_ROCKETRIDE?: string
  SPONSOR_MASKY?: string
  SPONSOR_SNYK?: string
  SPONSOR_PRELINT?: string
}

type Ctx = Context<{ Bindings: Env }>

const DEFAULT_OPERATOR = APPROVAL_POLICY.defaultReviewer
const DEFAULT_ESCALATION_OWNER: string = centerData.escalation.default_owner

export const app = new Hono<{ Bindings: Env }>()
app.use('/*', cors())

/**
 * One line per request, and one per failure.
 * FLOW: request -> handler -> timing line · handler throws -> error line WITH the cause -> 500
 * A handler that throws would otherwise return an opaque 500 with nothing written down --
 * on Workers there is no other place to look afterwards.
 */
app.use('/*', async (c, next) => {
  const started = Date.now()
  try {
    await next()
  } catch (error: unknown) {
    Logger.error('request_failed', error, {
      method: c.req.method,
      path: c.req.path,
      ms: Date.now() - started,
    })
    throw error
  }

  // Parent questions and answers are deliberately absent: a log is not a place for family data.
  Logger.info('request', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - started,
  })

  // Visibility for a demo with no real users: who opened it, from where.
  // Written to D1 only -- read privately with a wrangler query, never served by any route.
  // FLOW: any request (GET or POST) -> recordVisit -> visits row: ip, geo, path, user agent
  // 1. every method, not just GET: asking a question is a POST, and a GET-only gate made
  //    the one interaction worth seeing -- did they actually try the chat -- invisible
  // 2. path only, never the question text: line 86's rule still holds, no family data in a log
  // 3. awaited inline: waitUntil dropped the promise on this runtime. A few ms is the price
  //    of knowing; a failed write logs and never breaks the response.
  const cf = (c.req.raw as { cf?: { country?: string; city?: string } }).cf
  await recordVisit(c.env.DB, {
    ip: c.req.header('CF-Connecting-IP') ?? null,
    country: cf?.country ?? null,
    city: cf?.city ?? null,
    path: c.req.path,
    userAgent: c.req.header('User-Agent') ?? null,
  }).catch((error: unknown) => Logger.error('visit_write_failed', error, {}))
})

/**
 * Seed on the first request that needs data.
 * FLOW: request -> seedIfEmpty -> count > 0 ? no-op : insert the 45 policies
 * Workers have no boot hook, and seeding is idempotent, so the cheap COUNT is the price of
 * never shipping an empty centre.
 */
async function db(c: Ctx): Promise<D1Like> {
  const seeded = await seedIfEmpty(c.env.DB)
  if (seeded > 0) Logger.info('policies_seeded', { count: seeded })
  return c.env.DB
}

// ─── Health ───

app.get('/api/health', (c) => {
  const llm = geminiFromEnv(c.env.GEMINI_API_KEY)
  return c.json({
    ok: true,
    center: centerData.center.name,
    model: llm?.name ?? null,
    modelConfigured: llm !== null,
  })
})

// ─── The parent side ───

app.post('/api/ask', async (c) => {
  const body = await c.req.json<{ question?: string; sessionId?: string }>()
  const question = body.question?.trim() ?? ''

  if (question.length === 0) {
    return c.json({ error: 'A question is required.' }, 400)
  }

  const llm = geminiFromEnv(c.env.GEMINI_API_KEY)
  if (llm === null) {
    return c.json({ error: 'No model is configured. Set GEMINI_API_KEY.' }, 503)
  }

  const store = await db(c)
  const askedAt = new Date().toISOString()
  const sessionId = body.sessionId ?? null

  // What this parent already said, so "what about preschool" resolves against the question
  // before it rather than starting cold.
  const history = await getHistoryFor(store, sessionId)
  const approved = await getApproved(store)
  const bookings = await getBookings(store)

  // Turns that just left the verbatim window fold into the session's rolling summary --
  // one summariser call per overflow, stored, so long chats stay flat-cost forever.
  let summary: string | undefined
  if (sessionId !== null && history.length > MAX_HISTORY_TURNS) {
    const prior = await getSessionSummary(store, sessionId)
    const boundary = history.length - MAX_HISTORY_TURNS
    const covered = prior?.turnsCovered ?? 0

    if (boundary > covered) {
      const fresh = history.slice(covered, boundary)
      const updated = await summariseHistory(llm, {
        priorSummary: prior?.summary ?? null,
        turns: fresh,
      })
      if (updated.trim().length > 0) {
        await saveSessionSummary(store, sessionId, updated, boundary)
        summary = updated
      }
    } else {
      summary = prior?.summary
    }
  }

  // The model is the one dependency that fails from outside: quota, network, a bad key.
  // It gets its own catch so the parent sees an honest line rather than an opaque 500,
  // and the cause is written down rather than swallowed.
  let result: Awaited<ReturnType<typeof answerQuestion>>
  try {
    result = await answerQuestion(
      { text: question, askedAt, history, ...(summary === undefined ? {} : { summary }) },
      { llm, approved, bookings },
    )
  } catch (error: unknown) {
    Logger.error('answer_failed', error, { sessionId, questionLength: question.length })
    return c.json(
      { error: 'The front desk cannot answer right now. Please call the centre.' },
      503,
    )
  }

  // A booking the gate allowed becomes a row; the UNIQUE constraint is the final referee.
  if (result.bookingMade !== undefined) {
    await addBooking(store, result.bookingMade.date, result.bookingMade.time)
  }

  // Track which policies earn their keep, and which questions have nothing behind them.
  if (result.usedPolicyId !== undefined) {
    const cited = result.usedPolicyId
    const policy = approved.find((p) => cited.startsWith(`${p.id}@`))
    await recordPolicyUse(store, cited, policy?.labels ?? [], question, askedAt)
  } else if (result.nearMiss === true) {
    await recordNearMiss(store, result.route, question, askedAt)
  }

  const conversationId = `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`

  await recordConversation(store, {
    id: conversationId,
    sessionId,
    askedAt,
    question,
    outcome: result.outcome,
    route: result.route,
    answer: result.message,
    citation: result.citation,
    handledBy: result.routeTo ?? 'Front desk',
    topic: result.topic,
    confidence: result.confidence,
    trace: result.trace,
    // What this answer cost. One JSON column beside the trace, so future views -- cost per
    // day, slowest tool -- read it with no schema change.
    ...(result.metrics === undefined ? {} : { metrics: result.metrics }),
  })

  // Outcome and route only -- never the question or the answer. What an operator needs to
  // see in aggregate is how often the desk answers, escalates, or has nothing.
  Logger.info('question_answered', {
    conversationId,
    outcome: result.outcome,
    route: result.route,
    cited: result.usedPolicyId ?? null,
    escalatedTo: result.routeTo ?? null,
    confidence: result.confidence,
  })

  // The agents who worked on it, read from the trace, for the crew view and the activity feed.
  const agents = stepsFromTrace(result)
  await recordActivity(store, agents, question, askedAt).catch((error: unknown) =>
    Logger.error('activity_write_failed', error, {}),
  )

  // Max let a person know. Fire-and-forget: the answer never waits on the webhook.
  let notified: Notified | undefined
  if (result.outcome === 'sent_to_person' && result.routeTo !== null) {
    const { person, role } = parseRouteTo(result.routeTo)
    const sent = notifyEscalation(c.env.N8N_WEBHOOK_URL, {
      event: 'escalation',
      person,
      role,
      question,
      sessionId,
      at: askedAt,
    })
    notified = sent.notified
    keepAlive(c, sent.pending)
  }

  // The id goes back so the parent UI can rate this specific answer.
  return c.json({ ...result, conversationId, agents, ...(notified === undefined ? {} : { notified }) })
})

/** waitUntil on Workers; under Node there is no execution context and the promise just runs. */
function keepAlive(c: Ctx, pending: Promise<void>): void {
  try {
    c.executionCtx.waitUntil(pending)
  } catch {
    void pending
  }
}

// ─── The crew ───

app.get('/api/agents', (c) => c.json({ agents: AGENTS }))

const SPONSOR_MODES = ['REAL', 'CACHED', 'FALLBACK'] as const
type SponsorMode = (typeof SPONSOR_MODES)[number]

function sponsorMode(value: string | undefined): SponsorMode {
  const upper = value?.trim().toUpperCase()
  return SPONSOR_MODES.find((mode) => mode === upper) ?? 'FALLBACK'
}

app.get('/api/sponsors', (c) =>
  c.json({
    sponsors: {
      n8n: { mode: (c.env.N8N_WEBHOOK_URL ?? '').trim().length > 0 ? 'REAL' : 'FALLBACK' },
      rocketride: { mode: sponsorMode(c.env.SPONSOR_ROCKETRIDE) },
      masky: { mode: sponsorMode(c.env.SPONSOR_MASKY) },
      snyk: { mode: sponsorMode(c.env.SPONSOR_SNYK) },
      prelint: { mode: sponsorMode(c.env.SPONSOR_PRELINT) },
    },
  }),
)

app.get('/api/activity', async (c) => {
  const asked = Number(c.req.query('limit') ?? '50')
  const limit = Number.isFinite(asked) ? Math.min(200, Math.max(1, Math.floor(asked))) : 50
  return c.json({ activity: await getActivity(await db(c), limit) })
})

/**
 * Quill drafts one policy from a question the desk could not answer.
 * FLOW: question + approved policies -> model drafts -> code validates -> approval queue
 * The draft always waits for a person, whatever the approval config says for creates.
 */
app.post('/api/curator/draft', async (c) => {
  const body = await c.req.json<{ question?: string }>().catch(() => ({ question: undefined }))
  const question = body.question?.trim() ?? ''
  if (question.length === 0) return c.json({ error: 'A question is required.' }, 400)

  const llm = geminiFromEnv(c.env.GEMINI_API_KEY)
  if (llm === null) return c.json({ error: 'No model is configured. Set GEMINI_API_KEY.' }, 503)

  const store = await db(c)
  const approved = await getApproved(store)
  const existing = approved.map((p) => `- [${p.labels.join(', ')}] ${p.text}`).join('\n')

  let reply
  try {
    reply = await llm.converse({
      system: CURATOR_SYSTEM,
      turns: [{ role: 'parent', text: `Parent question: ${question}\n\nExisting approved policies:\n${existing}` }],
      tools: [],
      temperature: 0,
    })
  } catch (error: unknown) {
    Logger.error('curator_failed', error, {})
    return c.json({ error: 'Quill could not draft that just now. Try again in a moment.' }, 503)
  }

  const draft = draftsFromModelReply(reply.text)[0]
  if (draft === undefined) return c.json({ error: 'Quill could not draft a policy for that question.' }, 422)

  const input: ProposeChangeInput = {
    kind: 'create',
    targetId: null,
    text: draft.text,
    labels: [...draft.labels],
    sensitive: draft.sensitive,
    reference: draft.reference,
    notes: `Drafted from: "${question}"`,
    proposedBy: 'quill',
    note: 'Drafted by Quill from an unanswered question, awaiting review.',
    ...(draft.sensitive ? { ownerId: DEFAULT_ESCALATION_OWNER } : {}),
  }
  const problem = validateProposal(input, approved)
  if (problem !== null) return c.json({ error: problem }, 422)

  const change = proposeChange(input, approved)
  await addChange(store, change)
  Logger.info('curator_drafted', { changeId: change.id })
  return c.json({ change }, 201)
})

// ─── Policies ───

/**
 * Everything the front desk can cite, in one list.
 * FLOW: approved prose + structured blocks in center.json -> one shape -> the operator view
 * 1. a parent can be shown a fact from either kind, so both need an id, an owner and a date
 * 2. structured facts are edited as fields, not prose, so they are marked as such
 * 3. nothing the front desk can say is missing from this list -- that is the whole point
 */
function structuredRecords(): readonly Record<string, unknown>[] {
  const blocks = [
    { key: 'hours', block: centerData.hours },
    { key: 'closures', block: centerData.closures },
    { key: 'tours', block: centerData.tours },
    { key: 'illness', block: centerData.illness },
  ] as const

  return blocks.map(({ key, block }) => {
    const record = block as unknown as Record<string, unknown>
    const ownerId =
      typeof record['owner_id'] === 'string' ? record['owner_id'] : DEFAULT_ESCALATION_OWNER
    const owner = centerData.staff.find((s) => s.id === ownerId)

    return {
      id: record['id'] ?? key,
      citeAs: record['cite_as'] ?? `center:${key}`,
      kind: record['kind'] ?? 'structured_facts',
      title: record['title'] ?? key,
      topic: key,
      editedAs: 'fields',
      noteForOperator: record['note_for_operator'] ?? null,
      ownerId,
      ownerName: owner?.name ?? null,
      ownerRole: owner?.role ?? null,
      lastReviewed: record['last_reviewed'] ?? null,
      reviewedBy: record['reviewed_by'] ?? null,
      /** The live values, so an operator sees what a parent would be told. */
      facts: block,
    }
  })
}

app.get('/api/policies', async (c) => {
  const approved = await getApproved(await db(c))
  return c.json({
    policies: approved.map((entry) => ({
      ...entry,
      citeAs: `${entry.id}@${entry.version}`,
      kind: 'approved_prose',
      editedAs: 'prose',
    })),
    structured: structuredRecords(),
  })
})

/**
 * Propose a change. Nothing takes effect until it is approved.
 * Creates, edits, and archives all land in the same queue.
 */
function propose(kind: ChangeKind) {
  return async (c: Ctx): Promise<Response> => {
    const body = await c.req.json<{
      text?: string
      labels?: string[]
      sensitive?: boolean
      reference?: string
      notes?: string
      note?: string
      proposedBy?: string
      ownerId?: string
    }>()

    const store = await db(c)
    const targetId = c.req.param('id') ?? null

    const input: ProposeChangeInput = {
      kind,
      targetId,
      ...(body.text !== undefined ? { text: body.text } : {}),
      ...(body.labels !== undefined ? { labels: body.labels } : {}),
      ...(body.sensitive !== undefined ? { sensitive: body.sensitive } : {}),
      ...(body.reference !== undefined ? { reference: body.reference } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      proposedBy: body.proposedBy ?? DEFAULT_OPERATOR,
      note: body.note ?? '',
      ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
    }

    const approved = await getApproved(store)

    const problem = validateProposal(input, approved)
    if (problem !== null) return c.json({ error: problem }, 400)

    const change = proposeChange(input, approved)

    // Config decides whether this waits for review or lands straight away. A policy marked
    // sensitive on either side of the change always waits for a person.
    const touchesSensitive = change.before?.sensitive === true || change.after?.sensitive === true
    if (!touchesSensitive && !needsApproval(kind)) {
      const applied = applyChange(change, approved, APPROVAL_POLICY.defaultReviewer)
      await setApproved(store, applied.policies)
      await addChange(store, applied.change)
      return c.json({ change: applied.change, applied: true }, 201)
    }

    await addChange(store, change)
    return c.json({ change, applied: false }, 201)
  }
}

// ─── Tours: schedule and held slots for the operator view ───

app.get('/api/bookings', async (c) => {
  const store = await db(c)
  const bookings = await getBookings(store)
  return c.json({
    schedule: {
      days: centerData.tours.days,
      times: centerData.tours.times,
      durationMinutes: centerData.tours.duration_minutes,
    },
    bookings,
  })
})

// ─── Bulk extraction: paste handbook text, get pending drafts ───

app.post('/api/extract', async (c) => {
  const body = await c.req.json<{ text?: string }>().catch(() => ({ text: undefined }))
  const pasted = body.text?.trim() ?? ''

  if (pasted.length === 0) return c.json({ error: 'Some handbook text is required.' }, 400)
  const words = pasted.split(/\s+/).length
  if (words > EXTRACT_WORD_LIMIT) {
    return c.json({ error: `That is ${words} words; the limit is ${EXTRACT_WORD_LIMIT}. Paste a section at a time.` }, 400)
  }

  const llm = geminiFromEnv(c.env.GEMINI_API_KEY)
  if (llm === null) return c.json({ error: 'No model is configured. Set GEMINI_API_KEY.' }, 503)

  // The model structures; code validates every draft; the queue stays the only path in.
  let reply
  try {
    reply = await llm.converse({ system: EXTRACT_SYSTEM, turns: [{ role: 'parent', text: pasted }], tools: [], temperature: 0 })
  } catch (error: unknown) {
    Logger.error('extract_failed', error, { words })
    return c.json({ error: 'Could not read that just now. Try again in a moment.' }, 503)
  }

  const drafts = draftsFromModelReply(reply.text)
  const store = await db(c)
  const approved = await getApproved(store)

  let proposed = 0
  for (const draft of drafts) {
    const input: ProposeChangeInput = {
      kind: 'create' as ChangeKind,
      targetId: null,
      text: draft.text,
      labels: [...draft.labels],
      sensitive: draft.sensitive,
      reference: draft.reference,
      notes: '',
      proposedBy: 'Handbook import',
      note: 'Extracted from pasted handbook text, awaiting review.',
    }
    if (validateProposal(input, approved) !== null) continue
    await addChange(store, proposeChange(input, approved))
    proposed += 1
  }

  Logger.info('extract_proposed', { words, drafts: drafts.length, proposed })
  return c.json({ proposed, found: drafts.length })
})

app.post('/api/policies', propose('create'))
app.patch('/api/policies/:id', propose('edit'))
app.delete('/api/policies/:id', propose('archive'))

// ─── The change queue ───

app.get('/api/changes', async (c) => c.json({ changes: await getChanges(await db(c)) }))

app.post('/api/changes/:id/approve', async (c) => {
  const store = await db(c)
  const change = await findChange(store, c.req.param('id'))
  if (change === undefined) return c.json({ error: 'No such change.' }, 404)

  const body = await c.req.json<{ reviewer?: string }>().catch(() => ({ reviewer: undefined }))

  try {
    const applied = applyChange(change, await getApproved(store), body.reviewer ?? DEFAULT_OPERATOR)
    // Policy set and change row commit together: a half-applied approval would leave a change
    // marked approved whose policy never landed.
    await commitApproval(store, applied.policies, applied.change)
    Logger.info('change_approved', {
      changeId: applied.change.id,
      kind: applied.change.kind,
      reviewer: applied.change.reviewedBy,
      policies: applied.policies.length,
    })
    return c.json({ change: applied.change })
  } catch (error: unknown) {
    Logger.error('change_approve_failed', error, { changeId: change.id, kind: change.kind })
    return c.json({ error: error instanceof Error ? error.message : 'Could not apply.' }, 400)
  }
})

app.post('/api/changes/:id/reject', async (c) => {
  const store = await db(c)
  const change = await findChange(store, c.req.param('id'))
  if (change === undefined) return c.json({ error: 'No such change.' }, 404)

  const body = await c.req.json<{ reviewer?: string }>().catch(() => ({ reviewer: undefined }))

  try {
    const rejected = rejectChange(change, body.reviewer ?? DEFAULT_OPERATOR)
    await replaceChange(store, rejected)
    Logger.info('change_rejected', { changeId: rejected.id, reviewer: rejected.reviewedBy })
    return c.json({ change: rejected })
  } catch (error: unknown) {
    Logger.error('change_reject_failed', error, { changeId: change.id })
    return c.json({ error: error instanceof Error ? error.message : 'Could not reject.' }, 400)
  }
})

// ─── Feedback ───

app.post('/api/feedback', async (c) => {
  const body = await c.req.json<{
    conversationId?: string
    route?: string
    helpful?: boolean
    note?: string
  }>()

  if (body.conversationId === undefined || body.helpful === undefined) {
    return c.json({ error: 'We need to know which answer, and whether it helped.' }, 400)
  }

  await recordFeedback(
    await db(c),
    {
      conversationId: body.conversationId,
      route: (body.route ?? 'unknown') as AnswerRoute,
      helpful: body.helpful,
      ...(body.note !== undefined ? { note: body.note } : {}),
    },
    new Date().toISOString(),
  )

  return c.json({ ok: true })
})

app.get('/api/feedback', async (c) => c.json(await getFeedbackSummary(await db(c))))

app.get('/api/usage', async (c) => {
  const store = await db(c)
  const usage = await getUsage(store)
  const policies = await getApproved(store)

  // An unused policy is as informative as a busy one, so every policy appears.
  const rows = policies.map((policy) => {
    const used = usage.byPolicy[policy.id]
    return {
      policyId: policy.id,
      labels: policy.labels,
      text: policy.text,
      timesUsed: used?.timesUsed ?? 0,
      lastUsedAt: used?.lastUsedAt ?? null,
      questions: used?.questions ?? [],
    }
  })

  return c.json({
    policies: rows.sort((a, b) => b.timesUsed - a.timesUsed),
    neverUsed: rows.filter((r) => r.timesUsed === 0).length,
    nearMisses: Object.values(usage.nearMisses).sort((a, b) => b.timesAsked - a.timesAsked),
  })
})

// ─── Reset, for demoing ───

app.post('/api/reset', async (c) => {
  const seeded = await resetAll(c.env.DB)
  return c.json({ ok: true, policies: seeded })
})

// ─── Conversations and stats ───

app.get('/api/conversations', async (c) => {
  const conversations = await getConversations(await db(c))
  return c.json({ conversations, threads: threadsFrom(conversations) })
})

app.get('/api/stats', async (c) => {
  const store = await db(c)
  const conversations = await getConversations(store)
  const changes = await getChanges(store)

  const answered = conversations.filter((r) => r.outcome === 'answered').length
  const sentToPerson = conversations.filter((r) => r.outcome === 'sent_to_person').length
  const noAnswer = conversations.filter((r) => r.outcome === 'no_answer').length

  // Group the unanswered by question text, so the operator sees what keeps coming up.
  const counts = new Map<string, number>()
  for (const record of conversations) {
    if (record.outcome === 'answered') continue
    const key = record.question.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const unanswered = [...counts.entries()]
    .map(([question, timesAsked]) => ({ question, timesAsked }))
    .sort((a, b) => b.timesAsked - a.timesAsked)
    .slice(0, 5)

  return c.json({
    answered,
    answeredThisWeek: answeredThisWeek(conversations, new Date().toISOString()),
    sentToPerson,
    noAnswer,
    total: conversations.length,
    awaitingApproval: changes.filter((change) => change.status === 'pending').length,
    unanswered,
  })
})

// ─── Center info, for the parent UI header ───

app.get('/api/center', (c) =>
  c.json({
    name: centerData.center.name,
    phone: centerData.center.phone,
    hours: centerData.hours,
    staff: centerData.staff,
  }),
)
