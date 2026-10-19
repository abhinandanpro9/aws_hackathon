import * as React from "react";
import { cn } from "@/lib/utils";

// One layout for every tall dialog and sheet: the body scrolls, the actions never leave.
// FLOW: bounded parent (max-h dialog/sheet) -> body flex-1 overflow -> footer pinned below
// The parent must be a bounded flex column, or the inner overflow has no height to work in.

interface ScrollShellProps {
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}

export function ScrollShell({ children, footer, className }: ScrollShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-3 pb-1">
        {footer}
      </div>
    </div>
  );
}
