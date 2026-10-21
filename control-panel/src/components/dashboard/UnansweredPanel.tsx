"use client";

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight } from "@/lib/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "@/lib/icons";
import { api } from "@/lib/api";
import type { UnansweredQuestion } from "@/lib/domain";
import { useAppState } from "@/lib/app-state";
import { AddPolicyDialog } from "@/components/shared/AddPolicyDialog";
import { DASHBOARD_TEXTS } from "./constants";

export function UnansweredPanel() {
  const t = DASHBOARD_TEXTS.unanswered;
  const { unanswered, refresh } = useAppState();
  const navigate = useNavigate();
  const [drafting, setDrafting] = useState<string | null>(null);

  const letQuillDraft = (item: UnansweredQuestion): void => {
    setDrafting(item.id);
    void api
      .curatorDraft(item.question)
      .then(async (change) => {
        if (change === null) {
          toast.error(t.quillFailed);
          return;
        }
        toast.success(t.quillDone, {
          action: { label: t.quillOpen, onClick: () => void navigate({ to: "/approvals" }) },
        });
        await refresh();
      })
      .finally(() => setDrafting(null));
  };
  const [selected, setSelected] = useState<UnansweredQuestion | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  const openFor = (item: UnansweredQuestion): void => {
    setSelected(item);
    setOpen(true);
  };

  return (
    <Card className="border-2 border-primary/30 bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-display text-xl">{t.title}</CardTitle>
          <Link
            to="/conversations"
            className="flex min-h-6 shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t.seeAll}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {unanswered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-foreground">{t.emptyTitle}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{t.emptyBody}</p>
          </div>
        ) : (
          unanswered.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => openFor(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFor(item);
                }
              }}
              className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.question}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.timesAsked === 1
                    ? t.askedOnce
                    : `${t.askedPrefix} ${item.timesAsked} ${t.askedManySuffix}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={drafting !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  letQuillDraft(item);
                }}
              >
                <Sparkles className="size-4" />
                {drafting === item.id ? t.quillDrafting : t.quillDraft}
              </Button>
              <Button
                size="sm"
                className="shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  openFor(item);
                }}
              >
                <Plus className="size-4" />
                {t.addPolicy}
              </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <AddPolicyDialog open={open} onOpenChange={setOpen} question={selected} />
    </Card>
  );
}
