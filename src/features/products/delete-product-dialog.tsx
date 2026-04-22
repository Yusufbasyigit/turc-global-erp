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
import { deleteProduct } from "./mutations";
import { productKeys } from "./queries";

export function DeleteProductDialog({
  productId,
  productName,
  open,
  onOpenChange,
  redirectOnSuccess = false,
}: {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectOnSuccess?: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  const deleteMut = useMutation({
    mutationFn: () => deleteProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`${productName} deleted`);
      onOpenChange(false);
      if (redirectOnSuccess) router.push("/products");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this product?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{productName}</strong> will be
            removed from all lists. Existing orders and shipments will still
            reference it — this is a soft delete.
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
