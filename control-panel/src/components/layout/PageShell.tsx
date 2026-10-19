import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 pb-24 md:px-8 md:py-12 md:pb-12">
      {children}
    </div>
  );
}
