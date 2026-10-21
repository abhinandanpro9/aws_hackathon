"use client";

import { Link } from "@tanstack/react-router";
import { Home, BookOpen, CheckCircle2, MessagesSquare, Sun, CalendarDays, Users } from "@/lib/icons";
import { useAppState } from "@/lib/app-state";
import { LAYOUT_TEXTS } from "./constants";
import { useCenterHeader } from "./use-center-header";

function items(pendingCount: number) {
  return [
    { to: "/crew", label: LAYOUT_TEXTS.nav.crew, icon: Users, count: 0 },
    { to: "/", label: LAYOUT_TEXTS.nav.home, icon: Home, count: 0 },
    { to: "/policies", label: LAYOUT_TEXTS.nav.policies, icon: BookOpen, count: 0 },
    {
      to: "/approvals",
      label: LAYOUT_TEXTS.nav.approvals,
      icon: CheckCircle2,
      count: pendingCount,
    },
    {
      to: "/conversations",
      label: LAYOUT_TEXTS.nav.conversations,
      icon: MessagesSquare,
      count: 0,
    },
    { to: "/tours", label: LAYOUT_TEXTS.nav.tours, icon: CalendarDays, count: 0 },
  ];
}

export function MobileTopBar() {
  const { centerName, operatorLine } = useCenterHeader();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
        <Sun className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-sm leading-tight font-semibold text-sidebar-foreground">
          {centerName}
        </p>
        {operatorLine === null ? null : (
          <p className="truncate text-xs text-muted-foreground">{operatorLine}</p>
        )}
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const { stats } = useAppState();
  const ITEMS = items(stats?.awaitingApproval ?? 0);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          className="relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium text-muted-foreground data-[status=active]:text-sidebar-accent-foreground"
        >
          <span className="relative">
            <item.icon className="size-5" />
            {item.count ? (
              <span
                aria-label={`${item.count} ${LAYOUT_TEXTS.approvalsWaitingLabel}`}
                className="absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full bg-primary text-xs leading-none text-primary-foreground"
              >
                {item.count}
              </span>
            ) : null}
          </span>
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
