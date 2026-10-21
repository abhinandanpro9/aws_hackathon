import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { ApprovalsView } from "@/components/approvals/ApprovalsView";
import { APPROVALS_TEXTS } from "@/components/approvals/constants";

export const Route = createFileRoute("/approvals")({
  component: ApprovalsPage,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Approvals | Sunflower Grove Front Desk" },
      {
        name: "description",
        content:
          "Review the policies pulled from the family handbook before parents ever see them.",
      },
      { property: "og:title", content: "Approvals | Sunflower Grove Front Desk" },
      {
        property: "og:description",
        content: "Approve, edit, or reject each passage read from your handbook.",
      },
    ],
  }),
});

function ApprovalsPage() {
  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold md:text-4xl">{APPROVALS_TEXTS.heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{APPROVALS_TEXTS.intro}</p>
        </div>
      </div>
      <div className="mt-8">
        <ApprovalsView />
      </div>
    </PageShell>
  );
}
