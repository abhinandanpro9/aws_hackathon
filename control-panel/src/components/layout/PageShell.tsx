import type { ReactNode } from "react";
import { LAYOUT_TEXTS } from "./constants";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 pb-24 md:px-8 md:py-12 md:pb-12">
      <div className="mb-4 flex justify-end">
        {/* Display only. There is no sign-in behind this. */}
        <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground">
          <img src="/avatars/director.png" alt="" className="size-5 rounded-full object-cover" />
          {LAYOUT_TEXTS.signedInChip}
        </span>
      </div>
      {children}
    </div>
  );
}
