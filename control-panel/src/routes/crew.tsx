import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { CrewView } from "@/components/crew/CrewView";

export const Route = createFileRoute("/crew")({
  component: CrewPage,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Crew | Sunflower Grove Front Desk" },
      { name: "description", content: "The six agents, what they do, and what they are doing right now." },
    ],
  }),
});

function CrewPage() {
  return (
    <PageShell>
      <div className="max-w-3xl">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Crew</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Six agents run the front desk. A person approves every change to what they can say.
        </p>
      </div>
      <div className="mt-8">
        <CrewView />
      </div>
    </PageShell>
  );
}
