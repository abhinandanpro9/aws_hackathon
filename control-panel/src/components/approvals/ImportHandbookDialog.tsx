"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollShell } from "@/components/ui/scroll-shell";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

// Paste handbook text; the engine reads it into policy DRAFTS for this queue.
// FLOW: paste -> word count gate -> /api/extract -> N pending drafts -> a person reviews each
// The AI here structures text an operator already owns. It approves nothing.

const WORD_LIMIT = 6000;

export function ImportHandbookDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const { refresh } = useAppState();

  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const over = words > WORD_LIMIT;

  const handleImport = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await api.extractDrafts(text.trim());
      if (result === null) {
        toast.error("Could not read that just now", { description: "Try again in a moment." });
        return;
      }
      await refresh();
      toast.success(`${result.proposed} draft${result.proposed === 1 ? "" : "s"} waiting on you`, {
        description: "Each one still needs your approval before it answers anyone.",
      });
      setText("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display">Import from your handbook</DialogTitle>
          <DialogDescription>
            Paste a section of your handbook. AI turns it into policy drafts for this queue.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
          <p className="text-sm font-medium text-warning">AI can misread.</p>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">
            Check each draft against your handbook before approving. Nothing answers a parent until
            you approve it.
          </p>
        </div>

        <ScrollShell
          footer={
            <>
              <Button disabled={busy || over || words === 0} onClick={() => void handleImport()}>
                {busy ? "Reading…" : "Create drafts"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <span
                className={
                  over
                    ? "ml-auto text-xs text-destructive"
                    : "ml-auto text-xs text-muted-foreground"
                }
              >
                {words.toLocaleString()} / {WORD_LIMIT.toLocaleString()} words
              </span>
            </>
          }
        >
          <Textarea
            autoFocus
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste handbook text here — a section at a time works best."
            className="min-h-48"
          />
          {over ? (
            <p className="mt-2 text-xs text-destructive">
              Too long for one pass. Paste a section at a time.
            </p>
          ) : null}
        </ScrollShell>
      </DialogContent>
    </Dialog>
  );
}
