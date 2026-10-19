import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentIcon, ChevronRightIcon } from "@/lib/icons";
import { type AgentId, type AskResponse } from "@/lib/api";
import { CrewTimeline } from "@/components/crew/CrewTimeline";
import { ANSWER_TEXT } from "./constants";
import { ContactCard } from "./ContactCard";
import { FeedbackButtons } from "./FeedbackButtons";
import { PolicySheet } from "./PolicySheet";
import { ReplyText } from "./ReplyText";

interface AnswerBubbleProps {
  reply: AskResponse;
  voiceOn: boolean;
  onActive: (agent: AgentId | null) => void;
}

export function AnswerBubble({ reply, voiceOn, onActive }: AnswerBubbleProps): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const isHandoff: boolean = reply.outcome !== "answered";

  return (
    <Card
      className={
        isHandoff
          ? "max-w-[92%] gap-3 rounded-2xl rounded-tl-sm border-handoff-border bg-card p-4 shadow-sm"
          : "max-w-[92%] gap-3 rounded-2xl rounded-tl-sm border-border bg-card p-4 shadow-sm"
      }
    >
      <ReplyText text={reply.message} />

      {reply.outcome === "answered" && reply.metrics ? (
        <p className="text-xs text-muted-foreground">
          {ANSWER_TEXT.answeredIn((reply.metrics.latencyMs / 1000).toFixed(1))}
        </p>
      ) : null}

      {reply.outcome === "answered" && reply.citation ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={ANSWER_TEXT.sourceAction}
          className="-mx-1 flex min-h-11 items-center gap-2 rounded-md px-1 text-left text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <DocumentIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{reply.citation}</span>
          <ChevronRightIcon className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
        </button>
      ) : null}

      {isHandoff && reply.routeTo ? (
        <div className="flex flex-col gap-2">
          <Badge
            variant="outline"
            className="w-fit border-handoff-border bg-handoff-surface text-xs font-medium text-handoff-foreground"
          >
            {ANSWER_TEXT.contactHeading}
          </Badge>
          <ContactCard routeTo={reply.routeTo} />
        </div>
      ) : null}

      {reply.outcome === "sent_to_person" && reply.route === "sensitive" ? (
        <p className="text-xs text-muted-foreground">{ANSWER_TEXT.handoffNote}</p>
      ) : null}

      {reply.outcome === "no_answer" ? (
        <p className="text-xs text-muted-foreground">{ANSWER_TEXT.gapNote}</p>
      ) : null}

      <CrewTimeline reply={reply} voiceOn={voiceOn} onActive={onActive} />

      <FeedbackButtons conversationId={reply.conversationId} route={reply.route} />

      {reply.citation ? (
        <PolicySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          citation={reply.citation}
          policyId={reply.usedPolicyId}
        />
      ) : null}
    </Card>
  );
}
