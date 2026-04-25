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
import { transactionKeys } from "@/features/transactions/queries";
import { softDeletePartner } from "./mutations";
import { partnerKeys } from "./queries";

export function DeletePartnerDialog({
  partnerId,
  partnerName,
  transactionCount,
  open,
  onOpenChange,
}: {
  partnerId: string;
  partnerName: string;
  transactionCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => softDeletePartner(partnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.partners() });
      toast.success(`${partnerName} deleted`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete"),
  });

  const description =
    transactionCount > 0
      ? `This partner has ${transactionCount} transaction${
          transactionCount === 1 ? "" : "s"
        } referencing them. They'll stay on those records even after deletion. Continue?`
      : "Deleted partners stay on historical transactions. You can restore them later. Continue?";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete <span className="font-semibold">{partnerName}</span>?
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
