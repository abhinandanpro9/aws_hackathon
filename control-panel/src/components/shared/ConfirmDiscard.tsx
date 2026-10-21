"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// The one question every dirty form asks before it throws work away.
// FLOW: close attempt while dirty -> this dialog -> keep editing, or discard for real
// Parents' policies are typed slowly on phones; losing a paragraph to a stray backdrop
// tap is the kind of thing an operator remembers.

interface ConfirmDiscardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
  keepLabel?: string;
  confirmLabel?: string;
}

export function ConfirmDiscard({
  open,
  onOpenChange,
  onDiscard,
  title = "Discard what you typed?",
  description = "Your edits here have not been saved. Closing now throws them away.",
  keepLabel = "Keep editing",
  confirmLabel = "Discard it",
}: ConfirmDiscardProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{keepLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
