"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsDownIcon, ThumbsUpIcon } from "@/lib/icons";
import { sendFeedback, type AskRoute } from "@/lib/api";
import { CHAT_TEXT } from "@/components/chat/constants";

// Whether an answer helped. The only evidence we will ever get for the trust claim.
// FLOW: parent taps -> local state changes at once -> request fires and is not waited on
// 1. shown on EVERY reply, including the ones we could not answer: a parent telling us an
//    honest "I do not have that" was still helpful is the most useful rating in the system
// 2. visible at rest, never on hover, because hover does not exist on a phone
// 3. a rating is final once given: the other option is removed, not left inviting a second tap
// 4. never blocks and never toasts; a failed rating is not the parent's problem

interface FeedbackButtonsProps {
  conversationId: string;
  route: AskRoute;
}

export function FeedbackButtons({
  conversationId,
  route,
}: FeedbackButtonsProps): React.JSX.Element | null {
  const [choice, setChoice] = useState<boolean | null>(null);

  // Nothing to rate against if the reply never reached the engine.
  if (conversationId.length === 0) return null;

  const rate = (helpful: boolean): void => {
    if (choice !== null) return;
    setChoice(helpful);
    void sendFeedback(conversationId, route, helpful);
  };

  // Once rated, only the chosen thumb remains, locked. Leaving the other one visible invites a
  // second tap on something that no longer does anything.
  if (choice !== null) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-primary">
          {choice ? (
            <ThumbsUpIcon className="size-4 fill-current" />
          ) : (
            <ThumbsDownIcon className="size-4 fill-current" />
          )}
        </span>
        <span className="text-xs text-muted-foreground">{CHAT_TEXT.feedbackThanks}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={CHAT_TEXT.helpfulLabel}
        onClick={() => rate(true)}
        className="size-11 text-muted-foreground hover:text-foreground"
      >
        <ThumbsUpIcon className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={CHAT_TEXT.notHelpfulLabel}
        onClick={() => rate(false)}
        className="size-11 text-muted-foreground hover:text-foreground"
      >
        <ThumbsDownIcon className="size-4" />
      </Button>
    </div>
  );
}
