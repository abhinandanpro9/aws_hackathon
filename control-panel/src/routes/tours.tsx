import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { ToursView } from "@/components/tours/ToursView";

export const Route = createFileRoute("/tours")({
  component: ToursPage,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Tours | Sunflower Grove Front Desk" },
      { name: "description", content: "Tour days, open slots, and the bookings Theo holds." },
    ],
  }),
});

function ToursPage() {
  return (
    <PageShell>
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Tours</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          When tours run, what is open, and the slots parents already hold.
        </p>
      </div>
      <div className="mt-8">
        <ToursView />
      </div>
    </PageShell>
  );
}
