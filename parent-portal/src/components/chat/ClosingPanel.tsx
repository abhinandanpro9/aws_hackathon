import { Button } from "@/components/ui/button";
import { parseContact, type AskResponse } from "@/lib/api";
import { CHAT_TEXT } from "./constants";

// Shown in place of the composer once a person owns the question.
// FLOW: handedOff -> this panel replaces the composer -> "Ask a new question" starts fresh
// 1. calm and final, not apologetic: the handoff is the system working, not failing
// 2. the contact card is NOT repeated here -- the reply bubble above already shows it, and
//    printing the same name and number twice on one screen reads as a glitch
// 3. we do not claim anyone has been notified, because nobody has. The parent makes the call

interface ClosingPanelProps {
  reply: AskResponse;
  onStartOver: () => void;
}

export function ClosingPanel({ reply, onStartOver }: ClosingPanelProps): React.JSX.Element {
  const contact = reply.routeTo === null ? null : parseContact(reply.routeTo);
  const firstName = contact === null ? null : (contact.name.split(" ")[0] ?? contact.name);

  return (
    <div className="sticky bottom-0 border-t border-border bg-card px-4 py-4">
      <div className="mx-auto flex max-w-[480px] flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {firstName === null
            ? CHAT_TEXT.handoffNoContact
            : CHAT_TEXT.handoffWithContact(firstName)}
        </p>

        <Button variant="outline" className="min-h-11 w-full" onClick={onStartOver}>
          {CHAT_TEXT.askSomethingElse}
        </Button>

        {/* The button throws the thread away, so it says so before it is pressed. */}
        <p className="text-center text-xs text-muted-foreground">
          {CHAT_TEXT.askSomethingElseHint}
        </p>

        {/* Honest about the prototype's edge: closing here is a demo choice, not the design.
            Handoff tokens, not muted: this note is about the hand-off, and it must not read
            as one more grey system hint. */}
        <p className="rounded-lg bg-handoff-surface px-3 py-2 text-center text-xs text-handoff-foreground italic">
          {CHAT_TEXT.demoHandoffNote}
        </p>
      </div>
    </div>
  );
}
