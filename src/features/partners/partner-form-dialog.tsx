"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transactionKeys } from "@/features/transactions/queries";
import {
  partnerFormSchema,
  type PartnerFormValues,
  type PartnerFormOutput,
} from "./schema";
import { getPartner, partnerKeys } from "./queries";
import { createPartner, renamePartner } from "./mutations";

const DEFAULT_VALUES: PartnerFormValues = { name: "" };

export function PartnerFormDialog({
  open,
  onOpenChange,
  partnerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId?: string | null;
}) {
  const isEdit = Boolean(partnerId);
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: partnerId ? partnerKeys.detail(partnerId) : ["partner", "new"],
    queryFn: () => getPartner(partnerId!),
    enabled: Boolean(partnerId) && open,
  });

  const form = useForm<PartnerFormValues, unknown, PartnerFormOutput>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      form.reset({ name: existing.name });
    } else if (!isEdit) {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, isEdit, existing, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: partnerKeys.all });
    qc.invalidateQueries({ queryKey: transactionKeys.partners() });
  };

  const createMut = useMutation({
    mutationFn: createPartner,
    onSuccess: () => {
      invalidate();
      toast.success("Partner added");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add partner"),
  });

  const renameMut = useMutation({
    mutationFn: (values: PartnerFormOutput) => renamePartner(partnerId!, values),
    onSuccess: () => {
      invalidate();
      toast.success("Partner renamed");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to rename"),
  });

  const submitting = createMut.isPending || renameMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) renameMut.mutate(values);
    else createMut.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename partner" : "Add partner"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="partner-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="partner-name"
              autoFocus
              placeholder="e.g. Yusuf"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
