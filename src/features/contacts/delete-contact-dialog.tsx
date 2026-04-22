"use client";

import { useRouter } from "next/navigation";
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
import { deleteContact } from "./mutations";
import { contactKeys } from "./queries";

export function DeleteContactDialog({
  contactId,
  contactName,
  open,
  onOpenChange,
  redirectOnSuccess = false,
}: {
  contactId: string;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectOnSuccess?: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  const deleteMut = useMutation({
    mutationFn: () => deleteContact(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.all });
      toast.success(`${contactName} deleted`);
      onOpenChange(false);
      if (redirectOnSuccess) router.push("/contacts");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{contactName}</strong> will be
            removed from all lists. Existing orders and transactions will
            still reference it — this is a soft delete.
          </AlertDialogDescription>
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
