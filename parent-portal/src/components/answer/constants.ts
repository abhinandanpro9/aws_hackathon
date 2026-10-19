export const ANSWER_TEXT = {
  sourcePrefix: "Family Handbook",
  sourceAction: "See the handbook page",
  answeredIn: (seconds: string): string => `Answered in ${seconds}s`,
  handoffNote: "Questions about custody always go to a person.",
  gapNote: "Your question has been passed to the office so they can add it.",
  contactHeading: "Call them directly",
  callLabel: "Call",
  sheetTitle: "From our handbook",
  /** Filled from the policy's own approvedBy/approvedAt. Never a stand-in name or date. */
  sheetApproved: (approver: string, approvedOn: string): string =>
    `Approved by ${approver}, ${approvedOn}`,
  sheetClose: "Close",
  sheetLoading: "Opening the handbook page",
  policyUnavailable: "We could not open the full page just now. The office can read it to you.",
} as const;
