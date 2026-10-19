import { Button } from "@/components/ui/button";
import { useCenter } from "@/hooks/use-center";
import { CHAT_TEXT, SUGGESTIONS } from "./constants";

// The greeting stays for the whole conversation; the chips do not.
// FLOW: chat opens -> greeting + chips -> parent sends -> greeting remains, chips go
// 1. a parent scrolling back must still see who Ava is and that it is automated
// 2. the chips are a starting nudge; once a conversation is under way they are clutter

interface OpeningStateProps {
  onPick: (question: string) => void;
  disabled: boolean;
  /** Chips are hidden once the parent has asked something. */
  showSuggestions: boolean;
}

export function OpeningState({
  onPick,
  disabled,
  showSuggestions,
}: OpeningStateProps): React.JSX.Element {
  const center = useCenter();

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-2">
        <p className="text-base leading-relaxed font-medium text-foreground">
          {center === null ? CHAT_TEXT.openingLinePending : CHAT_TEXT.openingLine(center.name)}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{CHAT_TEXT.openingSubline}</p>
      </div>
      {!showSuggestions ? null : (
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((question: string) => (
            <Button
              key={question}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onPick(question)}
              className="min-h-11 w-full justify-start rounded-full border-primary/40 bg-card px-4 py-3 text-left text-sm font-medium whitespace-normal text-foreground hover:bg-accent"
            >
              {question}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
