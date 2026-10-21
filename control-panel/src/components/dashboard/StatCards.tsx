"use client";

import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "@/lib/icons";
import { useAppState } from "@/lib/app-state";
import { DASHBOARD_TEXTS } from "./constants";

interface StatCardProps {
  title: string;
  value: number | string;
  subtext: string;
  to?: string;
  accent?: boolean;
}

function StatCard({ title, value, subtext, to, accent = false }: StatCardProps) {
  const body = (
    <Card
      className={
        accent
          ? "h-full border-primary/40 bg-accent transition-colors hover:bg-accent/80"
          : "h-full transition-colors hover:border-primary/30"
      }
    >
      <CardHeader className="pb-1 md:pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            accent
              ? "font-display text-3xl font-bold text-primary md:text-4xl"
              : "font-display text-3xl font-bold text-foreground md:text-4xl"
          }
        >
          {value}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground md:text-sm">
          {subtext}
          {to ? <ArrowRight className="size-3.5" /> : null}
        </p>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

export function StatCards() {
  const t = DASHBOARD_TEXTS.stats;
  const { stats } = useAppState();

  // Live numbers only. Zero means nothing has happened yet, which is the truth.
  const answered = stats?.answered ?? 0;
  const person = stats?.sentToPerson ?? 0;
  // The card must agree with the gap panel it links to, not the rare no_answer outcome.
  const waiting = stats?.unanswered.length ?? 0;
  const pending = stats?.awaitingApproval ?? 0;

  // Shown as its own arithmetic, never a bare figure: count times an adjustable guess.
  const savedCount = stats?.answeredThisWeek ?? 0;
  const savedMinutes = savedCount * DASHBOARD_TEXTS.minutesPerAnswer;
  const savedValue =
    savedMinutes >= 60 ? `${(savedMinutes / 60).toFixed(1)} hrs` : `${savedMinutes} min`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <StatCard title={t.answeredTitle} value={answered} subtext={t.answeredSub} />
      <StatCard title={t.personTitle} value={person} subtext={t.personSub} />
      <StatCard
        title={t.waitingTitle}
        value={waiting}
        subtext={t.waitingSub}
        to="/conversations?filter=needs"
        accent
      />
      <StatCard title={t.pendingTitle} value={pending} subtext={t.pendingSub} to="/approvals" />
      <StatCard
        title={t.savedTitle}
        value={savedValue}
        subtext={t.savedSub(savedCount, DASHBOARD_TEXTS.minutesPerAnswer)}
      />
    </div>
  );
}
