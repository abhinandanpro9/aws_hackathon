"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutcomeBadge } from "@/components/shared/OutcomeBadge";
import { useAppState } from "@/lib/app-state";
import type { Conversation, Outcome } from "@/lib/domain";
import { CONVERSATIONS_TEXTS } from "./constants";
import { ConversationSheet } from "./ConversationSheet";

type Filter = Outcome | "all" | "needs";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: CONVERSATIONS_TEXTS.filters.all },
  { value: "needs", label: CONVERSATIONS_TEXTS.filters.needs },
  { value: "answered", label: CONVERSATIONS_TEXTS.filters.answered },
  { value: "person", label: CONVERSATIONS_TEXTS.filters.person },
  { value: "none", label: CONVERSATIONS_TEXTS.filters.none },
];

export function ConversationsView() {
  const { threads } = useAppState();
  // The dashboard's "Waiting on you" card lands here pre-filtered, so the operator sees
  // the five questions the number promised, not every thread ever.
  const [filter, setFilter] = useState<Filter>(() => {
    if (typeof window === "undefined") return "all";
    return new URLSearchParams(window.location.search).get("filter") === "needs" ? "needs" : "all";
  });
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  // One row per sitting, not per message. A parent asking three things is one conversation.
  const all = useMemo<Conversation[]>(
    () =>
      threads.map((thread) => ({
        id: thread.sessionId,
        time: new Date(thread.startedAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        question: thread.firstQuestion,
        outcome:
          thread.outcome === "answered"
            ? "answered"
            : thread.outcome === "no_answer"
              ? "none"
              : "person",
        handledBy: thread.handledBy,
        messageCount: thread.messageCount,
        messages: thread.messages.map((m) => ({
          question: m.question,
          answer: m.answer,
          citation: m.citation,
          outcome:
            m.outcome === "answered" ? "answered" : m.outcome === "no_answer" ? "none" : "person",
          handledBy: m.handledBy,
          trace: m.trace,
          ...(m.metrics === undefined
            ? {}
            : {
                metrics: {
                  latencyMs: m.metrics.latencyMs,
                  modelCalls: m.metrics.modelCalls,
                  toolsUsed: m.metrics.toolsUsed,
                },
              }),
          time: new Date(m.askedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        })),
        answer: thread.messages[thread.messages.length - 1]?.answer ?? null,
        citation: null,
      })),
    [threads],
  );

  const rows = useMemo<Conversation[]>(
    () =>
      filter === "all"
        ? all
        : filter === "needs"
          ? all.filter((item) => item.outcome !== "answered")
          : all.filter((item) => item.outcome === filter),
    [all, filter],
  );

  // How many sit behind each filter, so the operator sees the shape before clicking.
  const countFor = (value: Filter): number =>
    value === "all"
      ? all.length
      : value === "needs"
        ? all.filter((item) => item.outcome !== "answered").length
        : all.filter((item) => item.outcome === value).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)}>
            <Badge variant={filter === item.value ? "default" : "outline"}>
              {`${item.label} (${countFor(item.value)})`}
            </Badge>
          </button>
        ))}
      </div>

      {filter === "needs" ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-foreground">
          {CONVERSATIONS_TEXTS.needsBanner}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-1 p-10 text-center">
          <p className="text-sm font-medium text-foreground">{CONVERSATIONS_TEXTS.emptyTitle}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{CONVERSATIONS_TEXTS.emptyBody}</p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <Card
            key={row.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer gap-2 p-4"
            onClick={() => {
              setSelected(row);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(row);
                setOpen(true);
              }
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{row.time}</span>
              <OutcomeBadge outcome={row.outcome} />
            </div>
            <p className="text-sm text-foreground">{row.question}</p>
            <p className="text-xs text-muted-foreground">
              {row.handledBy}
              {(row.messageCount ?? 1) > 1
                ? ` \u00b7 ${CONVERSATIONS_TEXTS.messageCount(row.messageCount ?? 1)}`
                : ""}
            </p>
          </Card>
        ))}
      </div>

      <Card className={rows.length === 0 ? "hidden" : "hidden overflow-hidden py-0 sm:block"}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">{CONVERSATIONS_TEXTS.table.time}</TableHead>
              <TableHead>{CONVERSATIONS_TEXTS.table.question}</TableHead>
              <TableHead className="w-44">{CONVERSATIONS_TEXTS.table.outcome}</TableHead>
              <TableHead className="w-40">{CONVERSATIONS_TEXTS.table.handledBy}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(row);
                  setOpen(true);
                }}
              >
                <TableCell className="text-sm text-muted-foreground">{row.time}</TableCell>
                <TableCell className="max-w-[420px] truncate text-sm">
                  {row.question}
                  {(row.messageCount ?? 1) > 1 ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {CONVERSATIONS_TEXTS.messageCount(row.messageCount ?? 1)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <OutcomeBadge outcome={row.outcome} />
                </TableCell>
                <TableCell className="text-sm">{row.handledBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ConversationSheet conversation={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
