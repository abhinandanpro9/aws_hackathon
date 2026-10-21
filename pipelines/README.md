# RocketRide pipelines

- `frontdesk-crew.pipe`: `chat` (parent question) → `agent_rocketride` Ava → one specialist → `response_answers` (cited answer).
- Ava: `agent_rocketride` with a Gemini `llm_gemini` and `memory_internal`; routes to one of four specialist agents.
- Lena, Nora, Theo, Max: each a sub-agent (`agent_rocketride`) with its own Gemini model, memory and a `tool_http_request` tool.
- Each specialist calls `POST /api/ask` on the front desk API; the API's own code makes the decision (policy, illness rule, tour, named person).
- `quill-curator.pipe`: `chat` (unanswered question) → `agent_rocketride` Quill → `tool_http_request` `POST /api/curator/draft` → `response_answers`.
- Quill's draft lands in the staff approval queue; nothing goes live until a person approves it.
- HTTP tools allow GET and POST only, and only to the front desk API host (URL whitelist).
- Secrets: set `ROCKETRIDE_GEMINI_KEY` in your RocketRide environment; the files hold only the `${ROCKETRIDE_GEMINI_KEY}` reference.
