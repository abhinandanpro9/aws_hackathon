export const DASHBOARD_TEXTS = {
  heading: "Front desk",
  headingFor: (name: string): string => `Good morning, ${name}`,
  subheading: "Here is what happened at the front desk.",
  stats: {
    answeredTitle: "Answered automatically",
    answeredSub: "so far",
    personTitle: "Sent to a person",
    personSub: "so far",
    waitingTitle: "Waiting on you",
    waitingSub: "questions with no answer yet",
    pendingTitle: "Policies awaiting approval",
    pendingSub: "from your handbook",
    savedTitle: "Time saved this week",
    // The stat shows its own math instead of inventing a figure; the centre adjusts the
    // minutes to its own reality.
    savedSub: (count: number, minutes: number): string =>
      `${count} answered × ${minutes} min each — your minutes may differ`,
  },
  // A conservative guess at the minutes one answered question would have taken a person.
  minutesPerAnswer: 3,
  summaryLine: (answered: number, total: number): string =>
    `The front desk answered ${answered} of ${total} questions without needing you.`,
  summaryEmpty: "Nothing has come in yet.",
  unanswered: {
    title: "What we could not answer",
    seeAll: "See all",
    description: "Add a policy and the front desk can answer these next time.",
    askedOnce: "asked 1 time",
    askedManySuffix: "times",
    askedPrefix: "asked",
    addPolicy: "Add a policy",
    quillDraft: "Let Quill draft it",
    quillDrafting: "Quill is drafting...",
    quillDone: "Quill drafted a policy — waiting for your approval",
    quillOpen: "Open Approvals",
    quillFailed: "Quill could not draft this one. Try again, or add a policy yourself.",
    emptyTitle: "Nothing unanswered right now.",
    emptyBody: "When the front desk cannot answer something, it will show up here.",
  },
  activity: {
    title: "Recent activity",
    description: "Most recent first.",
    seeAll: "See all",
    emptyTitle: "Nothing yet.",
    emptyBody: "Questions from parents will show up here as they come in.",
  },
} as const;
