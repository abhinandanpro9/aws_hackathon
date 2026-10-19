/** How the list can be ordered. Newest first is the default, because a new policy is
 *  the thing an operator most often wants to check. */
export const SORT_OPTIONS = ["newest", "mostUsed", "recentlyUsed"] as const;
export type SortKey = (typeof SORT_OPTIONS)[number];

export const POLICIES_TEXTS = {
  sort: {
    label: "Sort policies",
    options: {
      newest: "Newest first",
      mostUsed: "Used most often",
      recentlyUsed: "Used most recently",
    },
  },
  heading: "Policies",
  subheading: "Everything the front desk can say, straight from your handbook.",
  searchPlaceholder: "Search policies — try fever, lunch, pickup",
  searchLabel: "Search policies",
  searchClearLabel: "Clear search",
  neverUsed: "Not used yet",
  timesUsed: (n: number): string => `Answered ${n} ${n === 1 ? "question" : "questions"}`,
  usageHeading: "What parents are actually asking",
  usageNeverUsed: (n: number): string =>
    `${n} ${n === 1 ? "policy has" : "policies have"} never been used`,
  usageNearMiss: "Asked about, but we have no policy for it",
  usageAddPolicy: "Add a policy",
  filterAll: "All",
  showMore: "Show more",
  showLess: "Show less",
  edit: "Edit this policy",
  archive: "Archive this policy",
  approvedBy: "Approved by",
  addedBy: "Added by",
  justAdded: "Just added",
  addPolicy: "Add a policy",
  sensitiveNote: "Never answered automatically. Always routed to a person.",
  sensitiveTopic: "Sensitive",
  empty: {
    title: "No policy matches that. Try a different word, or add a new policy.",
    action: "Add a policy",
  },
  dialog: {
    title: "Edit policy",
    description:
      "Your change goes to the approval list. Nothing reaches a parent until it is approved.",
    textareaLabel: "What should we tell parents?",
    labelsLabel: "Labels",
    labelsPlaceholder: "food, meals",
    labelsHint: "Separate with commas. The front desk uses these to find this policy.",
    sourceLabel: "Where this comes from",
    sourcePlaceholder: "Family Handbook, Page 8, MEALS AND FOOD",
    sourceHint: "Shown to parents underneath the answer, so they can check it.",
    notesLabel: "Your notes",
    notesPlaceholder: "Anything your team should know about this one",
    notesHint: "Only your team sees this. Parents never do.",
    sensitiveLabel: "This should never be answered automatically — always send it to a person.",
    sensitiveHint:
      "Good for anything about custody, injuries, behaviour, or a specific child's medical needs.",
    citedAs: "Cited as",
    save: "Save changes",
    cancel: "Discard changes",
    saved: "Change proposed",
    savedDescription: "It is waiting on the approvals list.",
  },
  alwaysPerson: "Always a person",
  archived: "Policy archived",
  archivedDescription: "It will not be used to answer parents.",
} as const;
