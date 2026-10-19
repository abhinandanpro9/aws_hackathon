// The whole path from a parent's message to an answer, or to a named person.
// FLOW: model turn -> tool calls -> results back -> model turn -> checked answer
// 1. the model reads and routes; every tool still decides its own outcome in code
// 2. sensitivity is guarded IN THE TOOLS, so a model that fails to escalate still cannot
//    get an answer out -- there is no path to a fact that does not go through a tool
// 3. a stated fact must cite a source a tool handed out THIS message, or it is discarded
// 4. the loop is bounded; a model that never settles hands off rather than spending forever
// WHY: the cost of a confident wrong answer here is a health or licensing incident

import { CONVERSE_TEMPERATURE, MAX_HISTORY_TURNS, MAX_MODEL_TURNS } from '../config/loop.js'
import { conversePrompt } from '../prompts/converse.js'
import { getDeclarations, isKnownSource, runTool } from '../tools/registry.js'
import { describeOwner, ownerForTopic } from '../tools/shared/staff.js'
import { Logger } from '../lib/logger.js'
import type { AnswerResult, AnswerRoute, ParentQuestion, RunMetrics } from '../types/answer.js'
import type { Policy, TopicId } from '../types/knowledge.js'
import type { LlmClient, ToolCall, Turn } from '../types/llm.js'
import type { ToolName, ToolResult } from '../types/tools.js'

export interface AnswerContext {
  readonly llm: LlmClient
  readonly approved: readonly Policy[]
  /** Taken tour slots, loaded once per message; book_tour and availability read these. */
  readonly bookings?: readonly { readonly date: string; readonly time: string }[]
}

/**
 * Which tool answered, named for the operator view.
 * The route is reporting, never behaviour: it says how an answer was reached so a person
 * reading the log can tell a rule verdict from a policy read from a schedule lookup.
 */
const ROUTE_BY_TOOL: Readonly<Record<ToolName, AnswerRoute>> = {
  check_attendance: 'rule',
  lookup_policy: 'policy_lookup',
  get_center_facts: 'schedule',
  book_tour: 'schedule',
  escalate_to_person: 'sensitive',
}

// ─── Results ───

function handOff(
  route: AnswerRoute,
  message: string,
  routeTo: string,
  topic: TopicId | null,
  trace: readonly string[],
): AnswerResult {
  // A gap is a topic understood but unanswerable, which is what the operator's queue is for.
  const isGap = route === 'known_gap'

  return {
    outcome: isGap ? 'no_answer' : 'sent_to_person',
    route,
    message,
    citation: null,
    routeTo,
    handedOff: true,
    topic,
    confidence: 0,
    ...(isGap ? { nearMiss: true } : {}),
    trace,
  }
}

/** The one hand-off used whenever the loop itself fails, rather than a topic being sensitive. */
function cannotAnswer(reason: string, trace: string[]): AnswerResult {
  const owner = ownerForTopic('unknown')
  trace.push(reason)
  return handOff(
    'unknown',
    `Thank you for your patience. I would rather not guess at this one, so it is going to a person.

**${owner.name}**, our ${owner.role}, can help — call ${owner.phone} ext. ${owner.ext}.`,
    describeOwner(owner),
    null,
    trace,
  )
}

// ─── History ───

/** One line of a summarised exchange, short enough that fifty of them stay cheap. */
function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= 90 ? flat : `${flat.slice(0, 90)}…`
}

/**
 * Recent turns verbatim; anything older folds into one code-built summary turn.
 * FLOW: history -> older + recent MAX_HISTORY_TURNS -> summary turn + recent, verbatim
 * 1. built by code from the turns themselves: no extra model call, nothing invented
 * 2. the model can still resolve "the thing I asked at the start" against the summary
 * 3. cost stays bounded: each old exchange is one clipped line, not its full text
 */
function withOlderTurnsSummarised(
  history: readonly { readonly role: 'parent' | 'assistant'; readonly text: string }[],
  rollingSummary: string | null,
): readonly Turn[] {
  const recent = history.slice(-MAX_HISTORY_TURNS)
  const older = history.slice(0, history.length - recent.length)

  const turns: Turn[] = recent.map((turn) => ({ role: turn.role, text: turn.text }))

  // A model-written rolling summary (stored per session) wins: it stays one short
  // paragraph forever. The code-built line list is the fallback when none exists yet.
  const summaryText =
    rollingSummary !== null && rollingSummary.trim().length > 0
      ? rollingSummary.trim()
      : older.length > 0
        ? older
            .map((turn) => `- ${turn.role === 'parent' ? 'parent' : 'desk'}: ${clip(turn.text)}`)
            .join('\n')
        : null

  if (summaryText === null) return turns

  return [
    {
      role: 'tool',
      toolName: 'conversation_summary',
      text: `Earlier in this conversation (summarised by the system — cite none of it):\n${summaryText}`,
    },
    ...turns,
  ]
}

// ─── Cited sources ───

/**
 * The source ids an answer claims, read out of the model's SOURCE line.
 * One question is often two questions -- "what time do you close and what if I am late" --
 * so an answer can rest on two tools and must cite both, or half of it is unsourced.
 * FLOW: SOURCE line -> split on commas and "and" -> every id checked against what was offered
 */
export function splitCitedSources(line: string | null): readonly string[] {
  if (line === null) return []

  return line
    .split(/,|\band\b/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0 && piece.toLowerCase() !== 'none')
}

// ─── Tool results ───

/** What the model is shown after a tool runs. The source id is stated so it can cite it. */
function describeForModel(result: ToolResult): string {
  const source = result.sourceId === null ? 'none' : result.sourceId
  return `${result.answer}\n\n[source id: ${source}]`
}

interface RanTools {
  readonly turns: readonly Turn[]
  readonly results: readonly ToolResult[]
}

function runRequestedTools(
  calls: readonly ToolCall[],
  approved: readonly Policy[],
  trace: string[],
  bookings: readonly { readonly date: string; readonly time: string }[],
): RanTools {
  const turns: Turn[] = []
  const results: ToolResult[] = []

  for (const call of calls) {
    const result = runTool(call.name as ToolName, call.args, approved, { bookings })
    trace.push(`ran ${call.name}: ${result.outcome}${result.sourceId === null ? '' : ` (${result.sourceId})`}`)
    results.push(result)
    turns.push({ role: 'tool', text: describeForModel(result), toolName: call.name })
  }

  return { turns, results }
}

// ─── Entry point ───

/**
 * Answer a parent's question, or hand it to a named person.
 * The model may call tools over several turns; code checks every claim before it ships.
 */
export async function answerQuestion(
  question: ParentQuestion,
  context: AnswerContext,
): Promise<AnswerResult> {
  // Measured around EVERY return path rather than at each of them: eleven returns is eleven
  // chances to forget one, and a metric missing on the rare path is missing where it matters.
  const meter = new RunMeter()
  const startedAt = Date.now()
  const result = await answerQuestionInner(question, { ...context, llm: meter.wrap(context.llm) })
  return { ...result, metrics: meter.read(Date.now() - startedAt) }
}

/**
 * Counts what one question cost, without any caller having to remember to.
 * FLOW: wrap the client -> every converse() passes through -> read the totals at the end
 * It observes and never alters: the reply it returns is the reply it was given.
 */
class RunMeter {
  private modelCalls = 0
  private inputTokens = 0
  private outputTokens = 0
  private readonly toolsUsed: string[] = []

  wrap(llm: LlmClient): LlmClient {
    return {
      name: llm.name,
      converse: async (request) => {
        this.modelCalls += 1
        const reply = await llm.converse(request)
        if (reply.usage !== undefined) {
          this.inputTokens += reply.usage.inputTokens
          this.outputTokens += reply.usage.outputTokens
        }
        for (const call of reply.toolCalls) this.toolsUsed.push(call.name)
        return reply
      },
    }
  }

  read(latencyMs: number): RunMetrics {
    return {
      latencyMs,
      modelCalls: this.modelCalls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      toolsUsed: [...this.toolsUsed],
    }
  }
}

async function answerQuestionInner(
  question: ParentQuestion,
  context: AnswerContext,
): Promise<AnswerResult> {
  const trace: string[] = [`question received: "${question.text.slice(0, 60)}"`]

  const history: readonly Turn[] = withOlderTurnsSummarised(question.history ?? [], question.summary ?? null)

  const turns: Turn[] = [...history, { role: 'parent', text: question.text }]
  const tools = getDeclarations(context.approved)

  // Source ids handed out during THIS message. The model may cite these and nothing else.
  const offeredSources = new Set<string>()
  let lastResult: ToolResult | null = null
  // Every answered result this message, whichever turn it came in. A later hand-off appends
  // these rather than eating them: the $15 late-fee answer must survive a turn-two escalation.
  const answeredSoFar: ToolResult[] = []
  // Set when book_tour answered with the gate open; the caller performs the actual write.
  let bookingMade: { date: string; time: string } | undefined

  for (let pass = 0; pass < MAX_MODEL_TURNS; pass += 1) {
    let reply
    try {
      reply = await context.llm.converse({
        // Carries today's date at the centre, so "today" and "tomorrow" resolve to real
        // dates instead of reading as vague days and going to a person.
        system: conversePrompt(question.askedAt ?? new Date().toISOString()),
        turns,
        tools,
        temperature: CONVERSE_TEMPERATURE,
      })
    } catch (error: unknown) {
      // The parent gets one sentence; the operator needs the cause.
      // FLOW: converse throws -> log message/name/stack -> hand off with the same calm line
      // 1. bad key, quota, 500 and timeout are one sentence to a parent, on purpose
      // 2. discarding the error made every outage read "unreachable" with nothing to act on
      // LlmUnavailableError keeps the provider's own error in `reason`; describeError only
      // reads the wrapper, so the cause has to be unwrapped or the log says nothing useful.
      const reason = (error as { reason?: unknown }).reason
      Logger.error('model_unreachable', error, {
        pass,
        cause: reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? ''),
      })
      return cannotAnswer('the model was unreachable', trace)
    }

    // 2. Tool calls are a request, not an answer. Run them and go round again.
    if (reply.toolCalls.length > 0) {
      const ran = runRequestedTools(reply.toolCalls, context.approved, trace, context.bookings ?? [])

      for (const result of ran.results) {
        if (result.sourceId !== null) offeredSources.add(result.sourceId)
        if (result.outcome === 'answered' && result.answer.trim().length > 0) answeredSoFar.push(result)
        if (result.tool === 'book_tour' && result.detail['book'] === true) {
          bookingMade = {
            date: String(result.detail['requestedDate']),
            time: String(result.detail['requestedTime']),
          }
        }
      }

      // A tool that routed to a person ends the conversation there; the model does not
      // get to talk past a hand-off it was just handed.
      // One batch can carry several intents; the hand-off must not eat the others.
      // FLOW: collect every needs_human -> safety text verbatim, in order -> append same-batch
      //       answered facts -> every routed person named
      // 1. .find() used to take the first and return: hours fetched and thrown away, and a
      //    second escalation (custody) silently dropped [2026-08-25 probe]
      // 2. tool text ships verbatim and first; the merge appends, never rewords
      // WHY: a parent who asked four things and got one answer asks the other three again
      const routedAll = ran.results.filter(
        (result) => result.outcome === 'needs_human' && result.routeTo !== null,
      )
      const routed = routedAll[0]
      if (routed !== undefined && routed.routeTo !== null) {
        const wasSensitive = routed.detail['reason'] === 'sensitive_topic'
        // A gap is a topic we know we do not hold, which reads differently in the operator
        // view from a tool that simply could not answer.
        const wasGap =
          routed.detail['kind'] === 'known_gap' || routed.detail['reason'] === 'no_approved_entry'

        for (const each of routedAll) {
          trace.push(
            each.detail['reason'] === 'sensitive_topic'
              ? `tool ${each.tool} refused a sensitive topic, routed to a person`
              : `tool ${each.tool} routed to a person`,
          )
        }

        const route: AnswerRoute = wasSensitive
          ? 'sensitive'
          : wasGap
            ? 'known_gap'
            : ROUTE_BY_TOOL[routed.tool]

        const answered = answeredSoFar
        if (answered.length > 0) trace.push(`kept ${answered.length} answered result(s) alongside the hand-off`)

        const message = [
          ...routedAll.map((each) => each.answer),
          // Code builds this message, so code carries the bullet rule the prompt cannot reach.
          // A multi-line tool answer folds onto one line: one fact, one bullet.
          ...(answered.length > 0
            ? [
                `On your other questions:\n\n${answered
                  .map((each) => `- ${each.answer.replace(/\n+/g, ' ').trim()}`)
                  .join('\n')}`,
              ]
            : []),
        ].join('\n\n')

        // The merged message may carry a tool's "Booked" line; the write must travel with it.
        return {
          ...handOff(
            route,
            message,
            routedAll.map((each) => each.routeTo).join(' · '),
            wasSensitive ? ('sensitive' as TopicId) : null,
            trace,
          ),
          ...(bookingMade !== undefined ? { bookingMade } : {}),
        }
      }

      lastResult = ran.results[ran.results.length - 1] ?? lastResult

      // The model's own call must be echoed back, or it does not recognise having made it
      // and calls the same tool again until the loop gives up. A tool-only reply has no
      // text, so the call itself is what gets recorded.
      const asked = reply.toolCalls.map((call) => `${call.name}(${JSON.stringify(call.args)})`).join(', ')
      turns.push({ role: 'assistant', text: reply.text.trim().length > 0 ? reply.text : `Calling ${asked}` }, ...ran.turns)
      continue
    }

    // 3. No tool calls: this is the model's answer. Check it before a parent sees it.
    // An empty reply gets nudged and retried while turns remain, like bad tool args do.
    // FLOW: empty reply -> nudge turn -> next pass -> answer, or hand off at the turn cap
    // WHY: "any late fees?" retrieved the right policy, then the model went silent [2026-08-25]
    if (reply.text.trim().length === 0) {
      if (pass < MAX_MODEL_TURNS - 1) {
        trace.push('the model returned an empty reply, nudged it to answer')
        turns.push({
          role: 'tool',
          text: 'Your reply was empty. Answer the parent now, in the required JSON shape, citing the source ids you were handed.',
          toolName: 'system',
        })
        continue
      }
      return cannotAnswer('the model returned nothing', trace)
    }

    // Small talk claims no fact, so it needs no source. Anything that ran a tool does.
    if (offeredSources.size === 0) {
      trace.push('answered without a tool: no fact claimed')
      return {
        outcome: 'answered',
        route: 'unknown',
        message: reply.text.trim(),
        citation: null,
        routeTo: null,
        handedOff: false,
        topic: null,
        confidence: 1,
        trace,
      }
    }

    const cited = splitCitedSources(reply.citedSource)

    if (cited.length === 0) {
      return cannotAnswer('the answer cited no source, so it was discarded', trace)
    }

    // One invented id among several is still an invented id: the whole answer goes.
    const invented = cited.find(
      (source) => !isKnownSource(source, context.approved) || !offeredSources.has(source),
    )
    if (invented !== undefined) {
      return cannotAnswer(`the answer cited "${invented}", which no tool handed out — discarded`, trace)
    }

    trace.push(`answer accepted, cited ${cited.join(' + ')}`)

    // A policy id is reported for usage tracking; centre data and rule verdicts are not
    // policies, so they are skipped.
    const policyCitation = cited.find(
      (source) => !source.startsWith('center:') && !source.startsWith('rule:'),
    )

    return {
      outcome: 'answered',
      route: lastResult === null ? 'unknown' : ROUTE_BY_TOOL[lastResult.tool],
      message: reply.text.trim(),
      citation: lastResult?.citation ?? null,
      routeTo: null,
      handedOff: false,
      topic: null,
      confidence: 1,
      ...(policyCitation !== undefined ? { usedPolicyId: policyCitation } : {}),
      ...(bookingMade !== undefined ? { bookingMade } : {}),
      trace,
    }
  }

  return cannotAnswer(`the model did not settle within ${MAX_MODEL_TURNS} turns`, trace)
}
