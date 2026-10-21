"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OutcomeBadge } from "@/components/shared/OutcomeBadge";
import { Plus } from "@/lib/icons";
import type { Conversation } from "@/lib/domain";
import { useState } from "react";
import { AddPolicyDialog } from "@/components/shared/AddPolicyDialog";
import { ReplyText } from "@/components/shared/ReplyText";
import { CONVERSATIONS_TEXTS } from "./constants";

interface ConversationSheetProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationSheet({ conversation, open, onOpenChange }: ConversationSheetProps) {
  const t = CONVERSATIONS_TEXTS.sheet;
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [addQuestion, setAddQuestion] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[85dvh] overflow-y-auto rounded-t-2xl" : "w-full sm:max-w-md"}
      >
        <SheetHeader>
          <SheetTitle className="font-display">{t.title}</SheetTitle>
          <SheetDescription>{conversation ? conversation.time : ""}</SheetDescription>
        </SheetHeader>

        {conversation ? (
          <ScrollArea className="h-full px-4 pb-8">
            <div className="flex flex-col gap-5">
              <div className="flex">
                <OutcomeBadge outcome={conversation.outcome} />
              </div>

              {(conversation.messages ?? []).map((message, index) => (
                <div key={`${message.time}-${index}`} className="flex flex-col gap-3">
                  {index === 0 ? null : <Separator />}

                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {`${t.parentAsked} \u00b7 ${message.time}`}
                    </p>
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                      {message.question}
                    </p>
                  </div>

                  {message.answer === null ? null : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {t.weAnswered}
                      </p>
                      <ReplyText text={message.answer} />
                      {message.citation === null ? null : (
                        <p className="text-xs text-muted-foreground">{message.citation}</p>
                      )}
                      {message.outcome === "person" ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t.personNote(message.handledBy)}
                        </p>
                      ) : null}

                      {/* The gap loop, right where the gap is seen: an unanswered message
                          offers the same Add-a-policy the dashboard panel does. */}
                      {message.outcome === "answered" ? null : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="self-start"
                          onClick={() => {
                            setAddQuestion(message.question);
                            setAddOpen(true);
                          }}
                        >
                          <Plus className="size-4" />
                          {t.addPolicy}
                        </Button>
                      )}

                      {/* The answer's paper trail: which tools ran, what each decided, and
                          what it cost. Stored per message in D1; collapsed because most
                          reads of this sheet are about the words, not the plumbing. */}
                      {message.trace.length === 0 ? null : (
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
                            {t.howAnswered}
                            {message.metrics
                              ? ` · ${t.traceCost(message.metrics.latencyMs, message.metrics.modelCalls)}`
                              : ""}
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                            {message.trace.map((line, traceIndex) => (
                              <li key={traceIndex}>{line}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {(conversation.messages ?? []).length > 0 ? null : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm font-medium text-foreground">{t.noAnswerTitle}</p>
                  <p className="text-sm text-muted-foreground">{t.noAnswerBody}</p>
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus className="size-4" />
                    {t.addPolicy}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>

      <AddPolicyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        question={
          conversation
            ? {
                id: `conv-${conversation.id}`,
                question: addQuestion ?? conversation.question,
                timesAsked: 1,
              }
            : null
        }
      />
    </Sheet>
  );
}
