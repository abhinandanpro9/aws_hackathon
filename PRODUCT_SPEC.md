# Product spec: Sunflower Grove Front Desk

## Who it serves
- Parents asking a preschool everyday questions, often on a phone.
- The centre Director, who owns every answer the front desk can give.

## Crew
- Ava routes every question and writes the final answer.
- Lena answers from approved policies and centre facts only.
- Nora decides illness questions with the coded 9-step check. She never clears a sick child to attend.
- Theo checks tour slots. He never books one.
- Max hands sensitive or unanswerable questions to a named person and notifies them through n8n.
- Quill drafts new policies from unanswered questions. A draft never reaches a parent until the Director approves it.

## Rules every change must keep
1. Code makes every decision. The model only routes and words the answer.
2. Every answer cites `policy@version`, and code checks each citation. An invalid citation sends the question to a person.
3. Custody, injury, behaviour and a specific child's medication never reach the model.
4. A failed notification never blocks or breaks the parent's answer.
5. Every `/api/ask` response lists the agent steps that produced it, in order.
6. `/api/activity` returns the newest question first, with each question's steps in the order they ran.
