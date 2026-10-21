"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pencil } from "@/lib/icons";
import { ScrollShell } from "@/components/ui/scroll-shell";
import { ImportHandbookDialog } from "./ImportHandbookDialog";
import { UploadCloud } from "@/lib/icons";
import { useAppState } from "@/lib/app-state";
import type { Policy } from "@/lib/domain";
import { EditPolicyDialog } from "@/components/policies/EditPolicyDialog";
import { APPROVALS_TEXTS } from "./constants";
import { ChangeCard } from "./ChangeCard";

export function ApprovalsView() {
  const t = APPROVALS_TEXTS;
  const isMobile = useIsMobile();
  const { changes, policies } = useAppState();
  const [editing, setEditing] = useState<Policy | null>(null);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [viewing, setViewing] = useState<Policy | null>(null);
  const [viewOpen, setViewOpen] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);

  // What is waiting on the operator is the change queue: proposals nobody has ruled on yet.
  const pending = changes.filter((change) => change.status === "pending");
  // Decided changes are the paper trail -- including archives, whose text survives here.
  const decided = changes.filter((change) => change.status !== "pending");

  return (
    <Tabs defaultValue="waiting" className="flex flex-col gap-6">
      <TabsList>
        <TabsTrigger value="waiting">{`${t.tabs.waiting} (${pending.length})`}</TabsTrigger>
        <TabsTrigger value="approved">{`${t.tabs.approved} (${policies.length})`}</TabsTrigger>
        <TabsTrigger value="history">{t.tabs.history}</TabsTrigger>
      </TabsList>

      <TabsContent value="waiting" className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <UploadCloud className="size-4" />
            Import from your handbook
          </Button>
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t.emptyWaiting.title}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{t.emptyWaiting.body}</p>
          </div>
        ) : (
          pending.map((change) => <ChangeCard key={change.id} change={change} />)
        )}
      </TabsContent>

      <TabsContent value="approved">
        {/* The table needs six columns of width; a phone has none of it.
            FLOW: < md -> tappable card list -> Sheet with the full policy -> edit from there */}
        <div className="flex flex-col gap-3 md:hidden">
          {policies.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer gap-2 p-4"
              onClick={() => {
                setViewing(row);
                setViewOpen(true);
              }}
            >
              <div className="flex flex-wrap gap-1">
                {row.labels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
              <p className="line-clamp-3 text-sm text-foreground">{row.text}</p>
              <p className="text-xs text-muted-foreground">{`${row.approvedBy} · ${row.approvedOn}`}</p>
            </Card>
          ))}
        </div>

        <Card className="hidden overflow-hidden py-0 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.table.labels}</TableHead>
                <TableHead>{t.table.policy}</TableHead>
                <TableHead>{t.table.source}</TableHead>
                <TableHead>{t.table.approvedBy}</TableHead>
                <TableHead>{t.table.date}</TableHead>
                <TableHead className="text-right">{t.table.actionHeader}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.labels.map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-sm">{row.text}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.reference}</TableCell>
                  <TableCell className="text-sm">{row.approvedBy}</TableCell>
                  <TableCell className="text-sm">{row.approvedOn}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = policies.find((p) => p.id === row.id);
                        if (target === undefined) return;
                        setEditing(target);
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      {t.table.action}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="flex flex-col gap-3">
        {decided.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">{t.history.empty}</p>
          </div>
        ) : (
          decided.map((change) => (
            <Card key={change.id} className="gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={change.status === "approved" ? "default" : "outline"}>
                  {change.status}
                </Badge>
                <Badge variant="secondary">{change.kind}</Badge>
                <span className="text-xs text-muted-foreground">
                  {change.reviewedBy ?? change.proposedBy}
                  {change.reviewedAt ? ` · ${change.reviewedAt.slice(0, 10)}` : ""}
                </span>
              </div>
              <p className="line-clamp-3 text-sm text-foreground">
                {(change.after ?? change.before)?.text ?? ""}
              </p>
              {change.kind === "archive" && change.status === "approved" ? (
                <p className="text-xs text-muted-foreground">{t.history.archivedNote}</p>
              ) : null}
            </Card>
          ))
        )}
      </TabsContent>

      <Sheet open={viewOpen} onOpenChange={setViewOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={
            isMobile
              ? "flex max-h-[85dvh] flex-col rounded-t-2xl"
              : "flex w-full flex-col sm:max-w-md"
          }
        >
          <SheetHeader className="shrink-0">
            <SheetTitle className="font-display">{t.table.policy}</SheetTitle>
            <SheetDescription>
              {viewing ? `${viewing.approvedBy} · ${viewing.approvedOn}` : ""}
            </SheetDescription>
          </SheetHeader>
          {viewing ? (
            <ScrollShell
              className="px-4 pb-4"
              footer={
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewOpen(false);
                    setEditing(viewing);
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                  {t.table.action}
                </Button>
              }
            >
              <div className="flex flex-col gap-4 pb-2">
                <div className="flex flex-wrap gap-1">
                  {viewing.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{viewing.text}</p>
                <p className="text-xs text-muted-foreground">{viewing.reference}</p>
              </div>
            </ScrollShell>
          ) : null}
        </SheetContent>
      </Sheet>

      <ImportHandbookDialog open={importOpen} onOpenChange={setImportOpen} />

      <EditPolicyDialog policy={editing} open={editOpen} onOpenChange={setEditOpen} />
    </Tabs>
  );
}
