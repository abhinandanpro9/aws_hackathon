import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { ConversationsView } from "@/components/conversations/ConversationsView";
import { CONVERSATIONS_TEXTS } from "@/components/conversations/constants";

export const Route = createFileRoute("/conversations")({
  component: ConversationsPage,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Conversations | Sunflower Grove Front Desk" },
      {
        name: "description",
        content: "Every question families asked the front desk, and how each one was handled.",
      },
      { property: "og:title", content: "Conversations | Sunflower Grove Front Desk" },
      {
        property: "og:description",
        content: "Read the full exchange behind every answered and unanswered question.",
      },
    ],
  }),
});

function ConversationsPage() {
  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{CONVERSATIONS_TEXTS.heading}</h1>
      <p className="mt-2 text-muted-foreground">{CONVERSATIONS_TEXTS.subheading}</p>
      <div className="mt-8">
        <ConversationsView />
      </div>
    </PageShell>
  );
}
