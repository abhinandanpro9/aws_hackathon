import { Badge } from "@/components/ui/badge";
import { SunIcon } from "@/lib/icons";
import { CHAT_TEXT } from "./constants";

export function ChatHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[480px] items-center gap-3 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <SunIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm leading-tight font-semibold text-foreground">
              {CHAT_TEXT.title}
            </h1>
            {/* Persistent, not just in the greeting: a parent arriving mid-scroll still sees it. */}
            <Badge variant="secondary" className="shrink-0">
              {CHAT_TEXT.assistantBadge}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{CHAT_TEXT.headerTagline}</p>
          <p className="mt-1 w-fit max-w-full truncate rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            {CHAT_TEXT.signedInAs}
          </p>
        </div>
      </div>
    </header>
  );
}
