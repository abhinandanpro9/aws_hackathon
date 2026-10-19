"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UnansweredQuestion } from "@/lib/domain";
import { useAppState } from "@/lib/app-state";
import { ScrollShell } from "@/components/ui/scroll-shell";
import { ConfirmDiscard } from "@/components/shared/ConfirmDiscard";
import { ADD_POLICY_TEXTS } from "./constants";

interface AddPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: UnansweredQuestion | null;
}

export function AddPolicyDialog({ open, onOpenChange, question }: AddPolicyDialogProps) {
  const t = ADD_POLICY_TEXTS;
  const { staff, addPolicy } = useAppState();
  const [text, setText] = useState<string>("");
  const [askedText, setAskedText] = useState<string>("");
  const [labels, setLabels] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [alwaysPerson, setAlwaysPerson] = useState<boolean>(false);
  // Stable across renders: an inline map would refire the reset effect on every keystroke.
  const handlers = useMemo(
    () => staff.map((person) => ({ id: person.id, label: `${person.name} (${person.role})` })),
    [staff],
  );
  const [ownerId, setOwnerId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const dirty =
    text.trim().length > 0 ||
    labels.trim().length > 0 ||
    reference.trim().length > 0 ||
    notes.trim().length > 0;

  // Any close attempt -- Cancel, backdrop, Esc -- asks first when typed work would be lost.
  const guardedOpenChange = (next: boolean): void => {
    if (!next && dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (open) {
      setAskedText(question?.question ?? "");
      setText("");
      setLabels("");
      setReference("");
      setNotes("");
      setAlwaysPerson(false);
      setOwnerId("");
    }
  }, [open, handlers, question]);

  const parsedLabels = labels
    .split(",")
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0);

  // A policy needs a label or the front desk can never find it, a source or a parent cannot
  // check it, and a named person when it is one only a person may answer.
  const canSave =
    text.trim().length > 0 &&
    parsedLabels.length > 0 &&
    reference.trim().length > 0 &&
    (!alwaysPerson || ownerId.length > 0);

  const handleSave = (): void => {
    addPolicy({
      text: text.trim(),
      labels: parsedLabels,
      sensitive: alwaysPerson,
      reference: reference.trim(),
      notes: notes.trim(),
      ownerId: alwaysPerson ? ownerId : null,
      sourceQuestionId: question ? question.id : null,
    });
    toast.success(t.savedToast, { description: t.savedToastDescription });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display">{t.title}</DialogTitle>
        </DialogHeader>

        <ScrollShell
          footer={
            <>
              <Button disabled={!canSave} onClick={handleSave}>
                {t.save}
              </Button>
              <Button variant="ghost" onClick={() => guardedOpenChange(false)}>
                {t.cancel}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-5 pr-1">
            {question ? (
              <div className="rounded-lg border border-border bg-muted px-3 py-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t.contextLabel}
                </p>
                <Textarea
                  rows={2}
                  value={askedText}
                  onChange={(event) => setAskedText(event.target.value)}
                  className="mt-1 bg-background text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {question.timesAsked === 1
                    ? t.askedOnce
                    : `${t.askedPrefix} ${question.timesAsked} ${t.askedManySuffix}`}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-policy-answer">
                {t.answerLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Textarea
                id="add-policy-answer"
                autoFocus
                rows={5}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t.answerPlaceholder}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-policy-labels">
                {t.labelsLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="add-policy-labels"
                value={labels}
                placeholder={t.labelsPlaceholder}
                onChange={(event) => setLabels(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.labelsHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-policy-reference">
                {t.sourceLabel}
                <span aria-hidden="true" className="text-destructive">
                  {" "}
                  *
                </span>
              </Label>
              <Input
                id="add-policy-reference"
                value={reference}
                placeholder={t.sourcePlaceholder}
                onChange={(event) => setReference(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.sourceHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-policy-notes">{t.notesLabel}</Label>
              <Textarea
                id="add-policy-notes"
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
                  id="add-policy-sensitive"
                  checked={alwaysPerson}
                  onCheckedChange={(value) => setAlwaysPerson(value === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="add-policy-sensitive" className="text-sm leading-snug font-normal">
                  {t.sensitiveLabel}
                </Label>
              </div>
              {alwaysPerson ? (
                <p className="text-xs text-muted-foreground">{t.sensitiveHint}</p>
              ) : null}
            </div>

            {alwaysPerson ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-policy-owner">
                  {t.ownerLabel}
                  <span aria-hidden="true" className="text-destructive">
                    {" "}
                    *
                  </span>
                </Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="add-policy-owner">
                    <SelectValue placeholder={t.ownerPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {handlers.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {handlers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.ownerUnavailable}</p>
                ) : null}
              </div>
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
