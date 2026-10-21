"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollShell } from "@/components/ui/scroll-shell";
import { ConfirmDiscard } from "@/components/shared/ConfirmDiscard";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Policy } from "@/lib/domain";
import { useAppState } from "@/lib/app-state";
import { POLICIES_TEXTS } from "./constants";

// Editing what the front desk is allowed to say.
// FLOW: edit -> proposed change -> review queue -> approved -> the version moves
// 1. an edit never lands straight away; it goes through the same gate as a new policy
// 2. source and notes are separate fields: a parent can be shown the source, never the notes
// 3. marking a policy as always-a-person is the one change that can never be undone by the model

interface EditPolicyDialogProps {
  policy: Policy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPolicyDialog({ policy, open, onOpenChange }: EditPolicyDialogProps) {
  const [text, setText] = useState<string>("");
  const [labels, setLabels] = useState<string>("");
  const [sensitive, setSensitive] = useState<boolean>(false);
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const { editPolicy } = useAppState();

  const dirty =
    policy !== null &&
    (text !== policy.text ||
      labels !== policy.labels.join(", ") ||
      sensitive !== policy.sensitive ||
      reference !== policy.reference ||
      notes !== policy.notes);

  // Any close attempt -- Discard, backdrop, Esc -- asks first when work would be lost.
  const guardedOpenChange = (next: boolean): void => {
    if (!next && dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (policy) {
      setText(policy.text);
      setLabels(policy.labels.join(", "));
      setSensitive(policy.sensitive);
      setReference(policy.reference);
      setNotes(policy.notes);
    }
  }, [policy]);

  const t = POLICIES_TEXTS.dialog;

  // The toast follows the write, so it never reports a save that did not happen.
  const handleSave = async (): Promise<void> => {
    if (policy === null) return;
    setBusy(true);
    try {
      await editPolicy(policy.id, {
        text,
        labels: labels
          .split(",")
          .map((label) => label.trim().toLowerCase())
          .filter((label) => label.length > 0),
        sensitive,
        reference,
        notes,
      });
      onOpenChange(false);
      toast.success(t.saved, { description: t.savedDescription });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display">{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <ScrollShell
          footer={
            <>
              <Button variant="outline" onClick={() => guardedOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button disabled={busy || policy === null} onClick={() => void handleSave()}>
                {t.save}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 pr-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="policy-text">
                {t.textareaLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Textarea
                id="policy-text"
                value={text}
                rows={5}
                onChange={(event) => setText(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="policy-labels">
                {t.labelsLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="policy-labels"
                value={labels}
                placeholder={t.labelsPlaceholder}
                onChange={(event) => setLabels(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.labelsHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="policy-reference">
                {t.sourceLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="policy-reference"
                value={reference}
                placeholder={t.sourcePlaceholder}
                onChange={(event) => setReference(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.sourceHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="policy-notes">{t.notesLabel}</Label>
              <Textarea
                id="policy-notes"
                value={notes}
                rows={2}
                placeholder={t.notesPlaceholder}
                onChange={(event) => setNotes(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.notesHint}</p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="policy-sensitive"
                checked={sensitive}
                onCheckedChange={(next) => setSensitive(next === true)}
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="policy-sensitive" className="leading-snug">
                  {t.sensitiveLabel}
                </Label>
                <p className="text-xs text-muted-foreground">{t.sensitiveHint}</p>
              </div>
            </div>

            {policy !== null ? (
              <p className="text-xs text-muted-foreground">
                {t.citedAs}: <span className="font-mono">{policy.citeAs}</span>
              </p>
            ) : null}
          </div>
        </ScrollShell>
      </DialogContent>

      <ConfirmDiscard
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={() => {
          setConfirmOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
