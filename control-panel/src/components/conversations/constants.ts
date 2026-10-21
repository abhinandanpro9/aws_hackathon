export const CONVERSATIONS_TEXTS = {
  heading: "Conversations",
  subheading: "What parents are actually asking.",
  messageCount: (n: number): string => `${n} messages`,
  emptyTitle: "No questions yet.",
  emptyBody:
    "Everything a parent asks the front desk will appear here, with what was said and where it came from.",
  needsBanner:
    "These conversations had no automatic answer. Open one, read what the parent asked, and use \u201cAdd a policy for this\u201d so the desk can answer it next time.",
  filters: {
    all: "All",
    needs: "Needs you",
    answered: "Answered",
    person: "Sent to a person",
    none: "No answer",
  },
  table: {
    time: "Time",
    question: "Question",
    outcome: "Outcome",
    handledBy: "Handled by",
  },
  sheet: {
    title: "Conversation",
    parentAsked: "The parent asked",
    weAnswered: "We answered",
    howAnswered: "How this was answered",
    traceCost: (ms: number, calls: number): string =>
      `${(ms / 1000).toFixed(1)}s · ${calls} model ${calls === 1 ? "call" : "calls"}`,
    noAnswerTitle: "We could not answer this",
    noAnswerBody: "There is nothing in your handbook that covers this question yet.",
    addPolicy: "Add a policy for this",
    personNote: (handledBy: string): string =>
      `This was sent to ${handledBy}. Sensitive questions are never answered automatically.`,
    added: "Let's add a policy",
    addedDescription: "We will use it the next time a parent asks.",
  },
  empty: "Nothing here yet.",
} as const;
