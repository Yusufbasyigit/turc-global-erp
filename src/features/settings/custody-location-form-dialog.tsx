"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CUSTODY_LOCATION_TYPES,
  type CustodyLocation,
  type CustodyLocationType,
} from "@/lib/supabase/types";

import {
  custodyLocationFormSchema,
  type CustodyLocationFormValues,
} from "./schema";
import { settingsKeys, treasuryKeys } from "./queries";
import {
  createCustodyLocation,
  updateCustodyLocation,
} from "./mutations";

const DEFAULTS: CustodyLocationFormValues = {
  name: "",
  location_type: "bank",
  requires_movement_type: true,
};

const TYPE_LABEL: Record<CustodyLocationType, string> = {
  bank: "Bank",
  physical: "Physical",
};

export function CustodyLocationFormDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: CustodyLocation | null;
}) {
  const isEdit = Boolean(existing);
  const qc = useQueryClient();

  const form = useForm<CustodyLocationFormValues>({
    resolver: zodResolver(custodyLocationFormSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      form.reset({
        name: existing.name,
        location_type: existing.location_type as CustodyLocationType,
        requires_movement_type: existing.requires_movement_type,
      });
    } else {
      form.reset(DEFAULTS);
    }
  }, [open, isEdit, existing, form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: settingsKeys.all });
    qc.invalidateQueries({ queryKey: treasuryKeys.custody() });
  };

  const createMut = useMutation({
    mutationFn: createCustodyLocation,
    onSuccess: () => {
      invalidate();
      toast.success("Custody location created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: (values: CustodyLocationFormValues) =>
      updateCustodyLocation(existing!.id, values),
    onSuccess: () => {
      invalidate();
      toast.success("Custody location updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to update"),
  });

  const submitting = createMut.isPending || updateMut.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit custody location" : "Add custody location"}
          </DialogTitle>
          <DialogDescription>
            Custody locations are where accounts are held — banks, vaults,
            partner pockets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name *" error={form.formState.errors.name?.message}>
            <Input
              autoFocus={!isEdit}
              placeholder="e.g. Garanti BBVA, Şirket Kasa"
              {...form.register("name")}
            />
          </Field>

          <Field
            label="Type *"
            error={form.formState.errors.location_type?.message}
            hint="Bank for banks/cards, physical for cash/safes/Kasa."
          >
            <Controller
              name="location_type"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) =>
                    field.onChange(v as CustodyLocationType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTODY_LOCATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Requires movement type"
            error={
              form.formState.errors.requires_movement_type?.message
            }
            hint="When checked, transactions involving this location must specify a movement type (transfer, trade, etc.)."
          >
            <Controller
              name="requires_movement_type"
              control={form.control}
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span>Required</span>
                </label>
              )}
            />
          </Field>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
