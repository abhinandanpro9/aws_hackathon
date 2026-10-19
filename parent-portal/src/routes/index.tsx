import { createFileRoute } from "@tanstack/react-router";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CHAT_TEXT } from "@/components/chat/constants";

const TITLE = "Sunflower Grove Front Desk · run by an AI crew";
const DESCRIPTION =
  "Ask Sunflower Grove Early Learning Center about hours, meals, pickup, or a sick child. Every answer shows the handbook page behind it.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatScreen,
  pendingComponent: PendingScreen,
  errorComponent: ErrorScreen,
});

function PendingScreen(): React.JSX.Element {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ChatHeader />
      <div
        aria-label={CHAT_TEXT.pendingLabel}
        className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-4 py-6"
      >
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

function ErrorScreen(): React.JSX.Element {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <ChatHeader />
      <div className="mx-auto w-full max-w-[480px] px-4 py-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">{CHAT_TEXT.errorTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{CHAT_TEXT.errorBody}</p>
        <Button onClick={() => window.location.reload()} className="mt-6 min-h-11 w-full max-w-xs">
          {CHAT_TEXT.errorAction}
        </Button>
      </div>
    </div>
  );
}
