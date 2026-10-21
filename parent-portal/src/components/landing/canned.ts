import type { AskResponse } from "@/lib/api";

// A copy of a real lunch run from the live API. Shown only when the API cannot be reached,
// so the hero never sits empty.
export const CANNED_LUNCH: AskResponse = {
  conversationId: "canned",
  outcome: "answered",
  route: "policy_lookup",
  message:
    "Today's menu is posted on the **lobby board**. Meals are always provided by the center.",
  citation: "Family Handbook, Page 8, MEALS AND FOOD",
  routeTo: null,
  handedOff: false,
  usedPolicyId: "b0043a95-f687-4842-85f4-3623d9e3b8e8@1",
  agents: [
    { agent: "ava", action: "Read the question", handoffTo: "lena", ms: 0 },
    {
      agent: "lena",
      action: "Looked up the handbook policy: found the answer",
      tool: "lookup_policy",
      handoffTo: "ava",
      ms: 1513,
    },
    { agent: "ava", action: "Wrote the answer and checked every source", ms: 3026 },
  ],
};
