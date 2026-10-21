export const APPROVALS_TEXTS = {
  heading: "Approvals",
  intro:
    "Every change to what the front desk can say waits here first. Nothing answers a parent until you approve it.",
  tabs: {
    waiting: "Waiting on you",
    approved: "Approved",
    history: "History",
  },
  history: {
    empty: "No decided changes yet. Approvals and rejections will collect here.",
    archivedNote: "No longer answered from. The text is kept here.",
  },
  change: {
    kinds: {
      create: "New policy",
      edit: "Change to a policy",
      archive: "Removing a policy",
    },
    proposedBy: (who: string): string => `Proposed by ${who === "quill" ? "Quill" : who}`,
    nowReads: "Now reads",
    wouldRead: "Would read",
    labels: "Labels",
    reference: "Source",
    notes: "Your notes",
    sensitiveWarning:
      "This is marked as always going to a person. The front desk will never answer it itself.",
    approve: "Approve",
    editDraft: "Edit this draft",
    reject: "Turn down",
    approved: "Approved",
    approvedDescription: "The front desk can use this now.",
    rejected: "Turned down",
    rejectedDescription: "Nothing changed.",
  },
  emptyWaiting: {
    title: "Nothing waiting on you.",
    body: "Changes you or your team propose will show up here for review.",
  },
  table: {
    labels: "Labels",
    policy: "Policy",
    source: "Source",
    approvedBy: "Approved by",
    date: "Date",
    action: "Edit this policy",
    actionHeader: "Action",
  },
} as const;
