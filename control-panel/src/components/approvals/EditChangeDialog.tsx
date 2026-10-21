"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollShell } from "@/components/ui/scroll-shell";
import { ConfirmDiscard } from "@/components/shared/ConfirmDiscard";
import { Checkbox } from "@/components/ui/checkbox";
import { POLICIES_TEXTS } from "@/components/policies/constants";
import type { ApiChange } from "@/lib/api";

// Edit a pending proposal before it is approved.
// FLOW: prefill from the draft -> operator adjusts -> saved as a NEW proposal, the old one
//       is turned down automatically -> the queue stays the only path to a live answer
// Nothing here writes a policy directly: an edited draft is still a draft.

interface EditChangeDialogProps {
  change: ApiChange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fields: {
    text: string;
    labels: string[];
    reference: string;
    notes: string;
    sensitive: boolean;
  }) => Promise<void>;
}

export function EditChangeDialog({ change, open, onOpenChange, onSave }: EditChangeDialogProps) {
  const [text, setText] = useState<string>("");
  const [labels, setLabels] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [sensitive, setSensitive] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const t = POLICIES_TEXTS.dialog;
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  useEffect(() => {
    if (open && change?.after) {
      setText(change.after.text);
      setLabels(change.after.labels.join(", "));
      setReference(change.after.reference);
      setNotes(change.after.notes);
      setSensitive(change.after.sensitive);
    }
  }, [open, change]);

  const dirty =
    change?.after !== null &&
    change !== null &&
    (text !== change.after.text ||
      labels !== change.after.labels.join(", ") ||
      reference !== change.after.reference ||
      notes !== change.after.notes ||
      sensitive !== change.after.sensitive);

  const guardedOpenChange = (next: boolean): void => {
    if (!next && dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  const parsedLabels = labels
    .split(",")
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0);

  const canSave = text.trim().length > 0 && parsedLabels.length > 0 && reference.trim().length > 0;

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    try {
      await onSave({
        text: text.trim(),
        labels: parsedLabels,
        reference: reference.trim(),
        notes: notes.trim(),
        sensitive,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display">Edit this draft</DialogTitle>
          <DialogDescription>
            Saving replaces the waiting draft with your version. It still needs approval.
          </DialogDescription>
        </DialogHeader>

        <ScrollShell
          footer={
            <>
              <Button disabled={!canSave || busy} onClick={() => void handleSave()}>
                Save the edited draft
              </Button>
              <Button variant="ghost" onClick={() => guardedOpenChange(false)}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 pr-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-change-text">
                {t.textareaLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Textarea
                id="edit-change-text"
                rows={5}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-change-labels">
                {t.labelsLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="edit-change-labels"
                value={labels}
                placeholder={t.labelsPlaceholder}
                onChange={(event) => setLabels(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.labelsHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-change-reference">
                {t.sourceLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="edit-change-reference"
                value={reference}
                placeholder={t.sourcePlaceholder}
                onChange={(event) => setReference(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.sourceHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-change-notes">{t.notesLabel}</Label>
              <Textarea
                id="edit-change-notes"
                rows={2}
                value={notes}
                placeholder={t.notesPlaceholder}
                onChange={(event) => setNotes(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.notesHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="edit-change-sensitive"
                  checked={sensitive}
                  onCheckedChange={(value) => setSensitive(value === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="edit-change-sensitive" className="text-sm leading-snug font-normal">
                  {t.sensitiveLabel}
                </Label>
              </div>
              {sensitive ? (
                <p className="text-xs text-muted-foreground">{t.sensitiveHint}</p>
              ) : null}
            </div>
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
