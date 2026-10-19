"use client";

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "@/lib/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeBadge } from "@/components/shared/OutcomeBadge";
import { useAppState } from "@/lib/app-state";
import type { ActivityItem } from "@/lib/domain";
import { DASHBOARD_TEXTS } from "./constants";

// Recent activity, from the live conversation log when the engine is up.
// FLOW: engine /api/conversations -> app-state -> here
// 1. live rows only; there is no sample data anywhere in this app
// 2. an empty log shows an empty state rather than inventing activity
// 3. outcome names match the engine's, mapped once here

function toActivity(record: {
  id: string;
  askedAt: string;
  question: string;
  outcome: "answered" | "sent_to_person" | "no_answer";
}): ActivityItem {
  return {
    id: record.id,
    time: new Date(record.askedAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    description: record.question,
    outcome:
      record.outcome === "answered"
        ? "answered"
        : record.outcome === "no_answer"
          ? "none"
          : "person",
  };
}

export function ActivityPanel() {
  const t = DASHBOARD_TEXTS.activity;
  const { conversations } = useAppState();
  const items: ActivityItem[] = conversations.slice(0, 6).map(toActivity);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-display text-xl">{t.title}</CardTitle>
          <Link
            to="/conversations"
            className="flex min-h-6 shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t.seeAll}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-foreground">{t.emptyTitle}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{t.emptyBody}</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={
                index === 0
                  ? "flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  : "flex flex-col gap-1.5 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              }
            >
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{item.time}</span>
                <span className="min-w-0 text-sm text-foreground sm:truncate">
                  {item.description}
                </span>
              </div>
              <OutcomeBadge outcome={item.outcome} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
