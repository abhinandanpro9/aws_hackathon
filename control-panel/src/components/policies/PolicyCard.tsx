"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Pencil, Archive } from "@/lib/icons";
import type { Policy } from "@/lib/domain";
import { useAppState } from "@/lib/app-state";
import { ConfirmDiscard } from "@/components/shared/ConfirmDiscard";
import { POLICIES_TEXTS } from "./constants";

interface PolicyCardProps {
  policy: Policy;
  onEdit: (policy: Policy) => void;
}

export function PolicyCard({ policy, onEdit }: PolicyCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [confirmArchive, setConfirmArchive] = useState<boolean>(false);
  const { archivePolicy } = useAppState();
  const source = policy.reference.trim().length > 0 ? policy.reference : null;

  // The toast follows the write, so it never reports an archive that did not happen.
  const handleArchive = async (): Promise<void> => {
    setBusy(true);
    try {
      await archivePolicy(policy.id);
      toast.success(POLICIES_TEXTS.archived, {
        description: POLICIES_TEXTS.archivedDescription,
      });
    } finally {
      setBusy(false);
    }
  };

  // Sensitivity is a flag on the record now, not a label anyone could rename by accident.
  const isSensitive = policy.sensitive;

  return (
    <Card>
      <ConfirmDiscard
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        onDiscard={() => {
          setConfirmArchive(false);
          void handleArchive();
        }}
        title="Archive this policy?"
        description="The front desk stops answering from it. The archive waits in Approvals first, so it can still be rejected there."
        keepLabel="Keep it"
        confirmLabel="Send to Approvals"
      />
      <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {isSensitive ? (
              <Badge variant="outline" className="border-warning text-warning">
                <Shield className="size-3.5" />
                {POLICIES_TEXTS.alwaysPerson}
              </Badge>
            ) : null}
            {policy.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </span>
          {policy.isNew ? (
            <Badge className="ml-2 bg-highlight text-highlight-foreground">
              {POLICIES_TEXTS.justAdded}
            </Badge>
          ) : null}

          <p
            className={
              expanded
                ? "mt-3 text-sm leading-relaxed text-foreground"
                : "mt-3 line-clamp-3 text-sm leading-relaxed text-foreground"
            }
          >
            {policy.text}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {expanded ? POLICIES_TEXTS.showLess : POLICIES_TEXTS.showMore}
          </button>

          {isSensitive ? (
            <p className="mt-3 text-xs text-warning">{POLICIES_TEXTS.sensitiveNote}</p>
          ) : null}

          <div className="mt-3">
            <Badge variant={(policy.timesUsed ?? 0) === 0 ? "outline" : "secondary"}>
              {(policy.timesUsed ?? 0) === 0
                ? POLICIES_TEXTS.neverUsed
                : POLICIES_TEXTS.timesUsed(policy.timesUsed ?? 0)}
            </Badge>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {source === null
              ? `${POLICIES_TEXTS.addedBy} ${policy.approvedBy}, ${policy.approvedOn}`
              : `${source} · ${POLICIES_TEXTS.approvedBy} ${policy.approvedBy}, ${policy.approvedOn}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(policy)}>
            <Pencil className="size-4" />
            {POLICIES_TEXTS.edit}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmArchive(true)}>
            <Archive className="size-4" />
            {POLICIES_TEXTS.archive}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
