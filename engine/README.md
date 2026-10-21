# engine

The API and all the logic. The write-up — what this is, why it is built this way, the track,
the guardrails, the known gaps — is in the [root README](../README.md).

## Run it

```bash
npm install
cp .env.example .env      # then put a Gemini key in it
npm run serve             # :8787
```

| Command | Does |
|---|---|
| `npm run serve` | The API on :8787, state in the process |
| `npm test` | 242 unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + tests |
| `npm run smoke` | 9 checks against real Gemini |

## Layout

```
src/
  server/     app.ts is every route. index.ts (node) and worker.ts (cloudflare)
              both mount it, so a route cannot exist on one and not the other.
  tools/      one file per tool. Six of them.
  rules/      the illness ladder, the closure ladder, hours.
  pipeline/   the tool loop.
  llm/        the Gemini client and reply parsing.
  config/     the safety switches. policy.ts is the two that matter.
  lib/        logger.ts -- the only place this service writes a log line.
data/
  center.json The centre: 45 policies, hours, closures, tours, illness criteria.
migrations/   D1 schema.
tests/        21 files.
```

## State

Two stores behind one interface, so no route knows which it is talking to.

| Where | Store | Survives a restart |
|---|---|---|
| `npm run serve` | in-process (`memory-db.ts`) | no |
| Deployed / `npm run dev:worker` | D1 (`db.ts`) | yes |

The local store exists so the documented command runs with no Cloudflare account and no
native dependency. Only mutable state lives in D1 — policies, changes, conversations, usage,
feedback. The structured facts in `center.json` are read-only and ship with the code.

## Deploy

```bash
npm run migrate:remote          # once per database
wrangler secret put GEMINI_API_KEY
npm run deploy
```

Locally against the Workers runtime:

```bash
npm run migrate:local
npm run dev:worker              # :8787
```

## Logs

One JSON line per event, through `Logger` in `src/lib/logger.ts`. `console.*` is not used
anywhere else. A parent's question and the answer are never logged — outcome, route and
confidence only.

```bash
wrangler tail frontdesk-api
```
