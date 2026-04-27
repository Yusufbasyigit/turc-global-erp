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
import { setAccountActive } from "./mutations";
import { accountKeys } from "./queries";

export function DeactivateAccountDialog({
  accountId,
  accountName,
  open,
  onOpenChange,
}: {
  accountId: string;
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const deactivateMut = useMutation({
    mutationFn: () => setAccountActive(accountId, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.accounts() });
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success(`${accountName} deactivated`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to deactivate"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Deactivate <span className="font-semibold">{accountName}</span>?
          </AlertDialogTitle>
          <AlertDialogDescription>
            It will be hidden from new-transaction pickers but stay visible on
            existing transactions and treasury movements. You can reactivate
            it any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivateMut.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deactivateMut.mutate();
            }}
            disabled={deactivateMut.isPending}
          >
            {deactivateMut.isPending ? "Deactivating…" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
