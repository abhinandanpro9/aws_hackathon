import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { PoliciesView } from "@/components/policies/PoliciesView";
import { POLICIES_TEXTS } from "@/components/policies/constants";

export const Route = createFileRoute("/policies")({
  component: PoliciesPage,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Policies | Sunflower Grove Front Desk" },
      {
        name: "description",
        content: "Search every handbook policy the front desk can share with families.",
      },
      { property: "og:title", content: "Policies | Sunflower Grove Front Desk" },
      {
        property: "og:description",
        content: "Search, edit, and archive the policies behind every answer.",
      },
    ],
  }),
});

function PoliciesPage() {
  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{POLICIES_TEXTS.heading}</h1>
      <p className="mt-2 text-muted-foreground">{POLICIES_TEXTS.subheading}</p>
      <div className="mt-8">
        <PoliciesView />
      </div>
    </PageShell>
  );
}
