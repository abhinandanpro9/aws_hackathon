// Cloudflare Worker entry. The Node entry (src/server/index.ts) stays for local dev.
// FLOW: request -> Hono app -> c.env.DB (D1) -> JSON
// Both entries mount the SAME app, so a route cannot exist on one and not the other.

import { app } from './server/app.js'
import type { Env } from './server/app.js'
import type { ExecutionContext } from 'hono'

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
}
