export const LAYOUT_TEXTS = {
  centerNameUnknown: "Front desk",
  nav: {
    crew: "Crew",
    home: "Home",
    policies: "Policies",
    approvals: "Approvals",
    conversations: "Conversations",
    tours: "Tours",
  },
  approvalsWaitingLabel: "waiting on you",
  signedInAs: (name: string, role: string): string => `${name}, ${role}`,
  connected: "Connected to the front desk",
  disconnected: "Not connected to the front desk",
} as const;
