export const CHAT_TEXT = {
  /** Shown only until GET /api/center answers. Never a stand-in center name. */
  centerNamePending: "Front desk",
  title: "Sunflower Grove Front Desk · run by an AI crew",
  headerTagline: "Ava and her crew answer from our family handbook",
  openingLine: (centerName: string): string =>
    `Hi, I'm Ava, the AI receptionist at ${centerName}. My crew and I are here to help.`,
  openingLinePending: "Hi, I'm Ava, the AI receptionist. My crew and I are here to help.",
  openingSubline:
    "We answer from our family handbook, and I show you where each answer came from. Anything I am not sure about goes to a member of staff.",
  assistantBadge: "Automated",
  handoffWithContact: (firstName: string): string =>
    `That one is for ${firstName} — their number is above.`,
  handoffNoContact: "That one is best answered by a person. Our number is above.",
  /** Clears the thread and mints a new session id, so the hint has to say so. */
  askSomethingElse: "Ask a new question",
  askSomethingElseHint: "This clears the chat and starts fresh.",
  demoHandoffNote: "A member of staff picks this up from here.",
  helpfulLabel: "This helped",
  notHelpfulLabel: "This did not help",
  feedbackThanks: "Thanks, that helps us.",
  composerPlaceholder: "Ask about hours, meals, pickup, or a sick child…",
  sendLabel: "Send",
  listLabel: "Conversation with Ava and the AI front desk crew",
  thinkingLabel: "The front desk is writing a reply",
  pendingLabel: "Opening the front desk",
  errorTitle: "This page did not load",
  /** No phone number here: this screen renders before any API call has succeeded. */
  errorBody: "Please refresh the page to try again.",
  errorAction: "Try again",
} as const;

export const SUGGESTIONS: readonly string[] = [
  "Is my child too sick to come in?",
  "What time do you close?",
  "I forgot to pack lunch",
  "Are you open on Veterans Day?",
];
