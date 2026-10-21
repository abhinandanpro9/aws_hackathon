// Node entry for local dev. The Worker entry is src/worker.ts.
// FLOW: node -> local D1 shim -> the SAME Hono app the Worker mounts -> :8787
// 1. routes live in app.ts only: two copies of a route is how one gets fixed and the other rots
// 2. local dev talks to a real D1 through `wrangler dev`; this entry is for running the API
//    against a plain node process, so it needs a binding handed to it

import { serve } from '@hono/node-server'
import centerData from '../../data/center.json' with { type: 'json' }
import { app } from './app.js'
import { memoryDb } from './memory-db.js'
import { geminiFromEnv } from '../llm/gemini.js'
import { Logger } from '../lib/logger.js'
import type { Env } from './app.js'

const PORT = Number(process.env['PORT'] ?? '8787')

// Node has no D1 binding, so this entry runs the same app against an in-process store.
// Deployed, the binding is real D1 (see wrangler.toml). Both speak the same interface, so
// no route knows which one it is talking to.
const env: Env = {
  DB: memoryDb(),
  ...(process.env['GEMINI_API_KEY'] !== undefined
    ? { GEMINI_API_KEY: process.env['GEMINI_API_KEY'] }
    : {}),
}

const llm = geminiFromEnv()

Logger.info('server_start', {
  port: PORT,
  center: centerData.center.name,
  model: llm?.name ?? null,
  modelConfigured: llm !== null,
})

serve({
  fetch: (request: Request) => app.fetch(request, env),
  port: PORT,
})
