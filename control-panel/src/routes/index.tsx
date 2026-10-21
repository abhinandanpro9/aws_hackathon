import { createFileRoute } from "@tanstack/react-router";
import { RoutePending, RouteError } from "@/components/shared/RouteStates";
import { PageShell } from "@/components/layout/PageShell";
import { StatCards } from "@/components/dashboard/StatCards";
import { UnansweredPanel } from "@/components/dashboard/UnansweredPanel";
import { ActivityPanel } from "@/components/dashboard/ActivityPanel";
import { DASHBOARD_TEXTS } from "@/components/dashboard/constants";
import { useAppState } from "@/lib/app-state";

export const Route = createFileRoute("/")({
  component: Index,
  pendingComponent: RoutePending,
  errorComponent: ({ reset }) => <RouteError reset={reset} />,
  head: () => ({
    meta: [
      { title: "Front Desk Home | Sunflower Grove Early Learning Center" },
      {
        name: "description",
        content:
          "See what the AI front desk answered today at Sunflower Grove, and what still needs Rosa.",
      },
      { property: "og:title", content: "Front Desk Home | Sunflower Grove" },
      {
        property: "og:description",
        content: "Today's answered questions, unanswered questions, and recent activity.",
      },
    ],
  }),
});

function Index() {
  const { stats, staff } = useAppState();

  // The greeting names whoever the engine says runs the center, or nobody at all.
  const director = staff.find((person) => person.role.toLowerCase().includes("director"));
  const firstName = director?.name.split(" ")[0];
  const heading =
    firstName === undefined ? DASHBOARD_TEXTS.heading : DASHBOARD_TEXTS.headingFor(firstName);

  // Real counts only. With no traffic yet, say that rather than showing a made-up ratio.
  const total = stats?.total ?? 0;
  const summary =
    total === 0
      ? DASHBOARD_TEXTS.summaryEmpty
      : DASHBOARD_TEXTS.summaryLine(stats?.answered ?? 0, total);

  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">{heading}</h1>
      <p className="mt-2 text-muted-foreground">{DASHBOARD_TEXTS.subheading}</p>

      <div className="mt-8">
        <StatCards />
      </div>

      <p className="mt-4 text-sm text-foreground">{summary}</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <UnansweredPanel />
        <ActivityPanel />
      </div>
    </PageShell>
  );
}
