import { useEffect, useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentIcon } from "@/lib/icons";
import { getPolicy, type ApprovedPolicy } from "@/lib/api";
import { ANSWER_TEXT } from "./constants";

// The trust payoff: the rule exactly as an operator approved it.
// FLOW: parent taps the source line -> GET /api/policies -> the approved entry -> shown verbatim
// 1. the text, the approver and the date all come from the policy itself, never written here
// 2. a policy we cannot load says so; it never falls back to invented handbook wording
// 3. fetched on open rather than with the answer, because most parents never open the sheet

interface PolicySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citation: string;
  policyId: string | undefined;
}

/** "2026-08-12T10:00:00.000Z" -> "12 Aug 2026". Formats what the API sent, invents nothing. */
function formatApprovedOn(iso: string): string | null {
  const at: Date = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PolicySheet({
  open,
  onOpenChange,
  citation,
  policyId,
}: PolicySheetProps): React.JSX.Element {
  const [policy, setPolicy] = useState<ApprovedPolicy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open || policyId === undefined) return;
    let cancelled = false;
    setIsLoading(true);
    void getPolicy(policyId)
      .then((found: ApprovedPolicy | null) => {
        if (!cancelled) setPolicy(found);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, policyId]);

  const approvedOn: string | null = policy === null ? null : formatApprovedOn(policy.approvedAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* A bounded flex column: header and close button stay put, only the text scrolls.
          Without the column the inner overflow-y-auto has no height to scroll within, so a
          long policy grew the sheet and pushed the close button off the bottom of a phone. */}
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85svh] w-full max-w-[480px] flex-col gap-0 rounded-t-2xl"
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle className="text-base">{ANSWER_TEXT.sheetTitle}</SheetTitle>
          <SheetDescription className="sr-only">{citation}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          {isLoading ? (
            <div aria-label={ANSWER_TEXT.sheetLoading} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : (
            // Handbook prose carries its own line breaks. Rendered in a plain <p> they
            // collapse and a numbered list arrives as one paragraph.
            <p className="text-base leading-relaxed whitespace-pre-line text-foreground">
              {policy?.text ?? ANSWER_TEXT.policyUnavailable}
            </p>
          )}

          <Separator className="my-4" />
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <DocumentIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{policy?.reference ?? citation}</span>
          </p>

          {policy !== null && approvedOn !== null ? (
            <p className="mt-1 pl-[1.375rem] text-xs text-muted-foreground">
              {ANSWER_TEXT.sheetApproved(policy.approvedBy, approvedOn)}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-4 pt-3">
          <SheetClose asChild>
            <Button variant="secondary" className="min-h-11 w-full">
              {ANSWER_TEXT.sheetClose}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
