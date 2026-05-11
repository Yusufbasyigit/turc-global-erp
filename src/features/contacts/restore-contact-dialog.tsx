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
import { restoreContact } from "./mutations";
import { contactKeys } from "./queries";
import { orderKeys } from "@/features/orders/queries";
import { shipmentKeys } from "@/features/shipments/queries";
import { transactionKeys } from "@/features/transactions/queries";
import { productKeys } from "@/features/products/queries";

export function RestoreContactDialog({
  contactId,
  contactName,
  open,
  onOpenChange,
}: {
  contactId: string;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const restoreMut = useMutation({
    mutationFn: () => restoreContact(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`${contactName} restored`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to restore"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this contact?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{contactName}</strong> will be
            returned to your active contacts list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restoreMut.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              restoreMut.mutate();
            }}
            disabled={restoreMut.isPending}
          >
            {restoreMut.isPending ? "Restoring…" : "Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
