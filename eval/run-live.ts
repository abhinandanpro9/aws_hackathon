// The same golden set, asked of the LIVE API, with crew-routing checks on top.
// FLOW: case -> POST /api/ask (demo-eval- session, ~2/s) -> grade() answer -> route check -> RESULTS.md
// 1. answer accuracy is the existing grade(), unchanged; routing is scored separately
// 2. routing reads agents[]: which named agent ran which tool
// 3. demo-eval- sessions tag the n8n notices and activity rows as demo traffic

import { writeFileSync } from 'node:fs'
import { CASES, CATEGORIES } from './cases.js'
import { grade } from './run-eval.js'
import type { EvalCase } from './cases.js'

const API = process.env['API_URL'] ?? 'https://awshk-frontdesk-api.abhinandan-pro9.workers.dev'
const MIN_GAP_MS = Number(process.env['GAP_MS'] ?? '500')
const ONLY = (process.env['ONLY'] ?? '').split(',').filter((id) => id.length > 0)
const RESULTS_PATH = new URL('./RESULTS.md', import.meta.url).pathname

interface Step { agent: string; action: string; tool?: string }
interface LiveReply {
  outcome: 'answered' | 'sent_to_person' | 'no_answer'
  message: string
  citation: string | null
  agents?: Step[]
  trace?: string[]
  error?: string
  [key: string]: unknown
}

const OWNER: Record<string, string> = {
  lookup_policy: 'lena',
  get_center_facts: 'lena',
  check_attendance: 'nora',
  book_tour: 'theo',
  escalate_to_person: 'max',
}

/** null = routed as designed; otherwise what was wrong. */
function routeProblem(c: EvalCase, r: LiveReply): string | null {
  const steps = r.agents ?? []
  const has = (agent: string): boolean => steps.some((s) => s.agent === agent)
  const ranTool = (agent: string): boolean => steps.some((s) => s.agent === agent && s.tool !== undefined)

  // The fallback hand-off after a model failure is not a routing decision.
  if ((r.trace ?? []).some((line) => line.includes('the model was unreachable'))) return 'model unavailable'

  if (c.category === 'illness') {
    if (!ranTool('nora')) return 'nora never ran check_attendance'
    if (r.outcome === 'sent_to_person' && !has('max')) return 'handed off without max'
  }
  if (c.category === 'sensitive') {
    if (!has('max')) return 'max never took it'
    if (steps.some((s) => s.agent === 'lena' && s.action.includes('found the answer'))) return 'lena answered a sensitive question'
  }
  for (const tool of c.expectTools ?? []) {
    const owner = OWNER[tool]
    if (owner !== undefined && !steps.some((s) => s.agent === owner && s.tool === tool)) {
      return `${owner} never ran ${tool}`
    }
  }
  // An answer that rests on a tool must name its source. No tool ran = no fact claimed.
  if (r.outcome === 'answered' && steps.some((s) => s.tool !== undefined) && r.citation === null) {
    return 'answered with no cited source'
  }
  return null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function ask(c: EvalCase): Promise<LiveReply | null> {
  try {
    const res = await fetch(`${API}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: c.question, sessionId: `demo-eval-${c.id}-${Date.now().toString(36)}` }),
    })
    const body = (await res.json()) as LiveReply
    return body.error !== undefined ? null : body
  } catch {
    return null
  }
}

interface Row { c: EvalCase; verdict: string; reason: string; route: string | null; flow: string; outcome: string }

async function main(): Promise<void> {
  const started = Date.now()
  const selected = ONLY.length > 0 ? CASES.filter((c) => ONLY.includes(c.id)) : CASES
  const rows: Row[] = []

  for (const c of selected) {
    const t0 = Date.now()
    const reply = await ask(c)
    const graded = grade(c, reply as never)
    const route = reply === null ? 'no reply' : routeProblem(c, reply)
    const flow = (reply?.agents ?? []).map((s) => (s.tool === undefined ? s.agent : `${s.agent}(${s.tool})`)).join(' > ')
    rows.push({ c, verdict: graded.verdict, reason: graded.reason, route, flow, outcome: reply?.outcome ?? 'error' })
    console.log(`${graded.verdict.padEnd(7)} ${route === null ? 'ROUTE-OK ' : 'ROUTE-BAD'} ${c.id} | ${flow}${route === null ? '' : ` | ${route}`}`)
    const wait = MIN_GAP_MS - (Date.now() - t0)
    if (wait > 0) await sleep(wait)
  }

  const health = (await (await fetch(`${API}/api/health`)).json()) as { model: string | null }
  const seconds = Math.round((Date.now() - started) / 1000)
  const pct = (a: number, b: number) => (b === 0 ? '-' : `${Math.round((a / b) * 100)}%`)

  const lines: string[] = []
  const answerOk = rows.filter((r) => r.verdict === 'CORRECT').length
  const routeOk = rows.filter((r) => r.route === null).length
  const unsafe = rows.filter((r) => r.verdict === 'UNSAFE').length
  const unavailable = rows.filter((r) => r.route === 'model unavailable').length
  lines.push('# Live crew eval')
  lines.push('')
  lines.push(`- API: ${API}`)
  lines.push(`- Run: ${new Date(started).toISOString()}, ${seconds}s, ${rows.length} cases, 1 trial each, ${(1000 / MIN_GAP_MS).toFixed(1)} req/s max`)
  lines.push(`- Model (last to answer): ${health.model ?? 'none'}`)
  lines.push(`- **Answer accuracy: ${answerOk}/${rows.length} (${pct(answerOk, rows.length)})** · unsafe: ${unsafe}`)
  lines.push(`- **Routing accuracy: ${routeOk}/${rows.length} (${pct(routeOk, rows.length)})** · model unavailable on ${unavailable} cases`)
  lines.push('')
  lines.push('| Category | Cases | Answer pass | Routing pass |')
  lines.push('|---|---|---|---|')
  for (const cat of CATEGORIES) {
    const r = rows.filter((x) => x.c.category === cat)
    if (r.length === 0) continue
    const a = r.filter((x) => x.verdict === 'CORRECT').length
    const g = r.filter((x) => x.route === null).length
    lines.push(`| ${cat} | ${r.length} | ${a} (${pct(a, r.length)}) | ${g} (${pct(g, r.length)}) |`)
  }
  const failures = rows.filter((r) => r.verdict !== 'CORRECT' || r.route !== null)
  lines.push('')
  lines.push('## Failures')
  lines.push('')
  if (failures.length === 0) lines.push('None.')
  for (const f of failures) {
    const got = [f.verdict !== 'CORRECT' ? `${f.verdict}: ${f.reason}` : null, f.route !== null ? `route: ${f.route}` : null]
      .filter((x) => x !== null)
      .join('; ')
    lines.push(`- \`${f.c.id}\` "${f.c.question}" → expected ${f.c.expectedOutcome}${f.c.expectTools === undefined ? '' : ` via ${f.c.expectTools.join(', ')}`} → got ${f.outcome} [${f.flow}] — ${got}`)
  }
  writeFileSync(RESULTS_PATH, `${lines.join('\n')}\n`)
  console.log(`\nanswer ${answerOk}/${rows.length}, routing ${routeOk}/${rows.length}, unsafe ${unsafe}, model ${health.model}, ${seconds}s`)
}

void main()
