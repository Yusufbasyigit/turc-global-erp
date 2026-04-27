"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { treasuryKeys } from "@/features/treasury/queries";
import { softDeleteAccount } from "./mutations";
import { accountKeys } from "./queries";

export function DeleteAccountDialog({
  accountId,
  accountName,
  movementCount,
  open,
  onOpenChange,
}: {
  accountId: string;
  accountName: string;
  movementCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => softDeleteAccount(accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.accounts() });
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success(`${accountName} deleted`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete"),
  });

  const description =
    movementCount > 0
      ? `${accountName} has ${movementCount} treasury movement${
          movementCount === 1 ? "" : "s"
        }. Deleting will hide it from the list and from pickers but the historical link will remain. Continue?`
      : "Delete this account? It will disappear from the list and pickers, but you can restore it any time from the 'Show deleted' view.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete <span className="font-semibold">{accountName}</span>?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteMut.mutate();
            }}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
