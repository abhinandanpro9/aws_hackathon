import { Card } from "@/components/ui/card";
import { CHAT_TEXT } from "./constants";

export function ThinkingBubble(): React.JSX.Element {
  return (
    <Card
      aria-label={CHAT_TEXT.thinkingLabel}
      className="w-fit rounded-2xl rounded-tl-sm border-border bg-card px-4 py-4 shadow-sm"
    >
      <span className="flex items-center gap-1.5">
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:200ms]" />
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:400ms]" />
      </span>
    </Card>
  );
}
