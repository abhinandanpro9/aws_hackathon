import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/PageShell";

export const ROUTE_STATE_TEXTS = {
  errorTitle: "This page didn't load",
  errorBody: "Nothing is lost. Try again in a moment.",
  retry: "Try again",
} as const;

export function RoutePending() {
  return (
    <PageShell>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-5 w-96" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="mt-8 h-64 w-full" />
    </PageShell>
  );
}

export function RouteError({ reset }: { reset: () => void }) {
  return (
    <PageShell>
      <h1 className="font-display text-3xl font-bold md:text-4xl">
        {ROUTE_STATE_TEXTS.errorTitle}
      </h1>
      <p className="mt-2 text-muted-foreground">{ROUTE_STATE_TEXTS.errorBody}</p>
      <Button className="mt-6" onClick={reset}>
        {ROUTE_STATE_TEXTS.retry}
      </Button>
    </PageShell>
  );
}
