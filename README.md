# Sunflower Grove Front Desk · run by an AI crew

A preschool front desk staffed by six AI agents. A parent asks a question. Ava, the receptionist,
hands it to the specialist who owns the answer. That specialist decides in code, never by guessing,
and every answer cites the approved policy it came from. Anything sensitive goes to a named person.

Sunflower Grove is a fictional centre. The policy text comes from a public city family handbook.

## Live

| | |
|---|---|
| Parent chat | https://awshk-parent-portal.abhinandan-pro9.workers.dev |
| Operator dashboard | https://awshk-control-panel.abhinandan-pro9.workers.dev |
| API | https://awshk-frontdesk-api.abhinandan-pro9.workers.dev/api/health |

## The crew

| Agent | Role | What it owns |
|---|---|---|
| Ava | Receptionist | Reads the question, routes it, writes the cited answer |
| Lena | Handbook keeper | Approved policies and centre facts (hours, closures, meals) |
| Nora | Health lead | The 9-step "can my child come in?" illness check |
| Theo | Enrollment | Tour slots |
| Max | Escalation | Hands sensitive questions to a named person |
| Quill | Curator | Turns unanswered questions into draft policies for the Director to approve |
| Director (human) | Boss | Approves every policy change before a parent sees it |

## Guardrails

- The model routes and words answers. Rules in code make every decision.
- Every answer cites `policy@version`. Code checks each citation; an invented one goes to a person.
- Custody, injury and medication questions never reach the model.
- Nothing Quill drafts reaches a parent until the Director approves it.

## Sponsor tools

- **RocketRide:** the crew pipeline, in `pipelines/*.pipe`
- **Masky:** agent faces and Ava's voice
- **Prelint:** reviews every pull request against the product spec
- **Snyk:** security scan of the code

## A2A (Agent2Agent)

Each of the six agents is an A2A v1.0 server. Ava hands every tool call to the agent that owns it with a JSON-RPC `SendMessage`, and a rule's hand-off goes to Max the same way. So a fever question reads Ava → Nora → Max, and each step in `agents[]` carries `a2a: { method, taskId, messageId }`. If an A2A call fails, the tool runs directly.

- Spec: https://a2a-protocol.org/latest/specification/
- All six cards: https://awshk-frontdesk-api.abhinandan-pro9.workers.dev/a2a
- Nora's card: https://awshk-frontdesk-api.abhinandan-pro9.workers.dev/a2a/nora/.well-known/agent-card.json

```bash
curl -s -X POST https://awshk-frontdesk-api.abhinandan-pro9.workers.dev/a2a/nora \
  -H 'content-type: application/json' -H 'A2A-Version: 1.0' \
  -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"m1","role":"ROLE_USER","parts":[{"data":{"temperatureF":101}}]}}}'
```

The reply is a `task` in `TASK_STATE_COMPLETED`, with a text summary ("…means staying home") and the rule's full result as a data part.

## Run locally

```bash
./setup.sh                      # installs all three apps
cd engine && npm run serve      # API on :8787 (needs GEMINI_API_KEY in engine/.env)
cd control-panel && npm run dev # operator dashboard on :8080
cd parent-portal && npm run dev # parent chat on :8082
cd engine && npm test           # 403 tests
```

## Deploy your own copy (Cloudflare Workers)

1. `cp engine/wrangler.example.toml engine/wrangler.toml`
2. Fill in your Cloudflare account id, and create a D1 database (`wrangler d1 create <name>`) for its id.
3. Set the secrets: `wrangler secret put GEMINI_API_KEY` and, optionally, `wrangler secret put N8N_WEBHOOK_URL`.
4. `cd engine && npm run migrate:remote && npm run deploy`

`engine/wrangler.toml` is git-ignored, so your account details never get committed.
