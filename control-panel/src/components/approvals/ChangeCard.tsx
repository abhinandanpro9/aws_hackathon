"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";
import { EditChangeDialog } from "./EditChangeDialog";
import type { ApiChange } from "@/lib/api";
import { APPROVALS_TEXTS } from "./constants";

// One proposed change, waiting on a person.
// FLOW: someone proposes -> this card -> approve or turn down -> the engine applies or drops it
// 1. an edit shows both sides, so a reviewer reads what actually changes rather than trusting a summary
// 2. the sensitive flag is called out, because that decides whether the front desk may ever answer it
// 3. nothing here is live: the wording is deliberate about that

interface ChangeCardProps {
  readonly change: ApiChange;
}

export function ChangeCard({ change }: ChangeCardProps): React.JSX.Element {
  const t = APPROVALS_TEXTS.change;
  const { approveChange, rejectChange, addPolicy, editPolicy } = useAppState();
  const [busy, setBusy] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);

  // An edited draft becomes a NEW proposal; the old one is turned down for it. The queue
  // stays the only path to a live answer -- editing never skips review.
  const saveEditedDraft = async (fields: {
    text: string;
    labels: string[];
    reference: string;
    notes: string;
    sensitive: boolean;
  }): Promise<void> => {
    if (change.kind === "edit" && change.targetId !== null) {
      await editPolicy(change.targetId, fields);
    } else {
      await addPolicy({ ...fields, ownerId: null, sourceQuestionId: null });
    }
    await rejectChange(change.id);
    toast.success("Draft replaced", { description: "Your edited version is now the one waiting." });
  };

  const act = (run: (id: string) => Promise<void>) => (): void => {
    setBusy(true);
    void run(change.id).finally(() => setBusy(false));
  };

  const after = change.after;
  const before = change.before;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t.kinds[change.kind]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.proposedBy(change.proposedBy)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {change.proposedBy === "quill" ? (
            <Badge className="bg-slate-500 text-white">Proposed by Quill</Badge>
          ) : null}
          {change.proposedBy === "Handbook import" ? (
            <Badge className="border-warning/40 bg-warning-soft text-warning">Parsed with AI</Badge>
          ) : null}
          {after?.sensitive === true ? <Badge variant="destructive">Always a person</Badge> : null}
        </div>
      </div>

      {before !== null ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.nowReads}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-through">
            {before.text}
          </p>
        </div>
      ) : null}

      {after !== null ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {before === null ? t.wouldRead : t.wouldRead}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{after.text}</p>

          {after.labels.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{t.labels}:</span>
              {after.labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}

          {after.reference.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t.reference}: {after.reference}
            </p>
          ) : null}

          {after.notes.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.notes}: {after.notes}
            </p>
          ) : null}
        </div>
      ) : null}

      {after?.sensitive === true ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t.sensitiveWarning}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={act(approveChange)}>
          {t.approve}
        </Button>
        {change.kind === "archive" ? null : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>
            {t.editDraft}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={act(rejectChange)}>
          {t.reject}
        </Button>
      </div>

      <EditChangeDialog
        change={change}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={saveEditedDraft}
      />
    </Card>
  );
}
