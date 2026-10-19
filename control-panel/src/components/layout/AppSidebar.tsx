"use client";

import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Home, BookOpen, CheckCircle2, MessagesSquare, Sun, CalendarDays, Users } from "@/lib/icons";
import { LAYOUT_TEXTS } from "./constants";
import { useCenterHeader } from "./use-center-header";
import { useAppState } from "@/lib/app-state";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  count?: number;
}

function navItems(pendingCount: number): NavItem[] {
  return [
    { to: "/crew", label: LAYOUT_TEXTS.nav.crew, icon: Users },
    { to: "/", label: LAYOUT_TEXTS.nav.home, icon: Home },
    { to: "/policies", label: LAYOUT_TEXTS.nav.policies, icon: BookOpen },
    {
      to: "/approvals",
      label: LAYOUT_TEXTS.nav.approvals,
      icon: CheckCircle2,
      count: pendingCount,
    },
    { to: "/conversations", label: LAYOUT_TEXTS.nav.conversations, icon: MessagesSquare },
    { to: "/tours", label: LAYOUT_TEXTS.nav.tours, icon: CalendarDays },
  ];
}

export function AppSidebar() {
  const { stats } = useAppState();
  const { centerName, operatorLine } = useCenterHeader();
  const NAV_ITEMS = navItems(stats?.awaitingApproval ?? 0);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex items-start gap-3 px-5 py-6">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
          <Sun className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base leading-tight font-semibold text-sidebar-foreground">
            {centerName}
          </p>
          {operatorLine === null ? null : (
            <p className="mt-1 text-sm text-muted-foreground">{operatorLine}</p>
          )}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.count ? (
              <Badge
                aria-label={`${item.count} ${LAYOUT_TEXTS.approvalsWaitingLabel}`}
                className="bg-primary text-primary-foreground"
              >
                {item.count}
              </Badge>
            ) : null}
          </Link>
        ))}
      </nav>

      <ConnectionNote />
    </aside>
  );
}

/** Says plainly whether the engine is reachable. Empty screens mean no data, not sample data. */
function ConnectionNote() {
  const { isLive, modelName } = useAppState();

  return (
    <div className="border-t border-sidebar-border px-5 py-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={
            isLive
              ? "size-2 shrink-0 rounded-full bg-primary"
              : "size-2 shrink-0 rounded-full bg-muted-foreground/40"
          }
        />
        {isLive ? LAYOUT_TEXTS.connected : LAYOUT_TEXTS.disconnected}
      </p>
      {isLive && modelName ? (
        <p className="mt-1 text-xs text-muted-foreground">{modelName}</p>
      ) : null}
    </div>
  );
}
