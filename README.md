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

## Run locally

```bash
./setup.sh                      # installs all three apps
cd engine && npm run serve      # API on :8787 (needs GEMINI_API_KEY in engine/.env)
cd control-panel && npm run dev # operator dashboard on :8080
cd parent-portal && npm run dev # parent chat on :8082
cd engine && npm test           # 403 tests
```
