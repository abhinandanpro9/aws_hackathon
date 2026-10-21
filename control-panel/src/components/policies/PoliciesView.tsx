"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, UploadCloud } from "@/lib/icons";
import { ImportHandbookDialog } from "@/components/approvals/ImportHandbookDialog";
import type { Policy } from "@/lib/domain";
import { useAppState } from "@/lib/app-state";
import { AddPolicyDialog } from "@/components/shared/AddPolicyDialog";
import { POLICIES_TEXTS, SORT_OPTIONS, type SortKey } from "./constants";
import { PolicyCard } from "./PolicyCard";
import { EditPolicyDialog } from "./EditPolicyDialog";

export function PoliciesView() {
  const [query, setQuery] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const { policies, usage } = useAppState();
  const nearMisses = usage?.nearMisses ?? [];

  // Filters come from the labels that actually exist, so a label with nothing behind it
  // is never offered. Adding a policy adds its own filter.
  const countsByTopic = useMemo<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const policy of policies) {
      for (const label of policy.labels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  }, [policies]);

  const availableTopics = useMemo<string[]>(
    () => [...countsByTopic.keys()].sort(),
    [countsByTopic],
  );
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const filtered = useMemo<Policy[]>(() => {
    const needle = query.trim().toLowerCase();
    const matching = policies.filter((policy) => {
      const matchesTopic =
        selectedTopics.length === 0 ||
        selectedTopics.some((label) => policy.labels.includes(label));
      const matchesQuery =
        needle.length === 0 ||
        policy.text.toLowerCase().includes(needle) ||
        policy.labels.some((label) => label.toLowerCase().includes(needle)) ||
        policy.reference.toLowerCase().includes(needle);
      return matchesTopic && matchesQuery;
    });

    // A policy that has never answered anybody sorts last under both usage sorts, rather
    // than tying with one that answered yesterday.
    return [...matching].sort((a, b) => {
      if (sort === "mostUsed") return (b.timesUsed ?? 0) - (a.timesUsed ?? 0);
      if (sort === "recentlyUsed") {
        return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
      }
      return b.approvedOn.localeCompare(a.approvedOn);
    });
  }, [policies, query, selectedTopics, sort]);

  // One label at a time. Tapping the selected one clears it, so "All" is always reachable
  // without hunting for it.
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const selectTopic = (topic: string): void => {
    setSelectedTopics((current) => (current[0] === topic ? [] : [topic]));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadCloud className="size-4" />
          Import from your handbook
        </Button>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          {POLICIES_TEXTS.addPolicy}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          aria-label={POLICIES_TEXTS.searchLabel}
          value={query}
          onValueChange={setQuery}
          placeholder={POLICIES_TEXTS.searchPlaceholder}
          clearLabel={POLICIES_TEXTS.searchClearLabel}
          containerClassName="flex-1"
          className="h-12 text-base"
        />
        <Select value={sort} onValueChange={(next) => setSort(next as SortKey)}>
          <SelectTrigger className="h-12 sm:w-56" aria-label={POLICIES_TEXTS.sort.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {POLICIES_TEXTS.sort.options[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSelectedTopics([])}>
          <Badge variant={selectedTopics.length === 0 ? "default" : "outline"}>
            {`${POLICIES_TEXTS.filterAll} (${policies.length})`}
          </Badge>
        </button>
        {availableTopics.map((topic) => (
          <button key={topic} type="button" onClick={() => selectTopic(topic)}>
            <Badge variant={selectedTopics[0] === topic ? "default" : "outline"}>
              {`${topic} (${countsByTopic.get(topic) ?? 0})`}
            </Badge>
          </button>
        ))}
      </div>

      {nearMisses.length === 0 ? null : (
        <Card className="border-primary/30 bg-accent/40 p-4">
          <p className="text-sm font-medium text-foreground">{POLICIES_TEXTS.usageNearMiss}</p>
          <div className="mt-3 flex flex-col gap-2">
            {nearMisses.map((miss) => (
              <div
                key={miss.topic}
                className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {miss.topic.charAt(0).toUpperCase() + miss.topic.slice(1)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {`asked ${miss.timesAsked}\u00d7`}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {miss.questions[0] ?? ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  {POLICIES_TEXTS.usageAddPolicy}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{POLICIES_TEXTS.empty.title}</p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {POLICIES_TEXTS.empty.action}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onEdit={(item) => {
                setEditing(item);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <AddPolicyDialog open={addOpen} onOpenChange={setAddOpen} />

      <EditPolicyDialog policy={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <ImportHandbookDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
