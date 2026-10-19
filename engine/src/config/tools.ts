// Tool-layer tuning: what counts as a plausible argument, and how each tool is described.
// FLOW: model reads a description -> picks a tool -> args -> these bounds -> rule -> result
// 1. bounds exist to catch a model hallucinating a number, not to second-guess a parent
// 2. anything outside a bound is invalid_arguments, never a clamped value
// 3. these descriptions ARE the routing rules: the model has nothing else to route on

/** A human body temperature we are willing to reason about, in Fahrenheit. */
export const TEMPERATURE_BOUNDS = { min: 90, max: 115 } as const

/** Hours-since values a parent could plausibly report. */
export const HOURS_BOUNDS = { min: 0, max: 336 } as const

/**
 * What the model reads when routing. Wording here changes model behaviour, so a change
 * here is a behaviour change and the eval must be re-run.
 */
export const TOOL_DESCRIPTIONS = {
  lookup_policy:
    'Read an approved center policy back to a parent. Call this for meals and food, pickup and arrival, tuition and billing, enrollment, medication, or anything covered by the family handbook. Returns the exact words an operator approved.',
  get_center_facts:
    'Facts about the center itself, by topic. "hours": opening and closing times, drop-off, how late a child can stay. "closures": whether a particular day is open -- holidays, snow days, weekends. "tours": when tours run, for a parent asking in general -- to reserve a named date and time, call book_tour instead. "today": the current date at the center, when you need to be certain. "about": what the center is like, ages, rooms, accreditation, address. It does NOT hold staff-to-child ratios, room capacity or licence numbers -- those are licensing questions and go to escalate_to_person.',
  check_attendance:
    `Decide whether a child who is sick or has symptoms may come in today. Call this for any question about fever, vomiting, diarrhea, rash, pink eye, coughing, antibiotics, or a child seeming unwell. Do not decide this yourself.

READING TIME IS PART OF FILLING THIS IN, NOT GUESSING. Parents describe time in ordinary words, and a blank field reads to the rule as "never happened":
- "last night", "yesterday evening", "overnight" -> about 12
- "this morning" -> about 4
- "a couple of days ago", "two days ago" -> about 48
- "three days ago" -> about 72
- "last week" -> about 168
Use the closest reasonable number. Roughly right is far better than blank.

Fill in every field the parent gave you something for, even when they also say the child seems fine now. The rule decides what that means; you do not.

IF THE PARENT HAS NOT SAID WHAT IS WRONG, this tool cannot decide anything. "Is my child too sick to come in?" on its own names no symptom. Call it anyway -- it will tell you what is missing, and you then ask the parent that one question in your own words. Never invent a symptom to fill a field, and never take an empty report as "nothing is wrong".`,
  book_tour:
    'Book a tour slot, or find out whether one is free. Call this when a parent wants to book, reserve, or attend a specific tour. Needs the date as YYYY-MM-DD and one of the listed start times. The desk may not complete bookings itself; this tool says whether the slot is free and names who books it.',
  escalate_to_person:
    'Hand a question to a named member of staff. Call this for anything about custody, injuries, another child, a specific medical need, a complaint, or anything you are not sure about. Calling this is always better than guessing.',
} as const
