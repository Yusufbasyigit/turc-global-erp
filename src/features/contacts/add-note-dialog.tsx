"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  contactNoteFormSchema,
  type ContactNoteFormValues,
} from "./schema";
import { addContactNote } from "./mutations";
import { contactKeys } from "./queries";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AddNoteDialog({
  contactId,
  open,
  onOpenChange,
}: {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<ContactNoteFormValues>({
    resolver: zodResolver(contactNoteFormSchema),
    defaultValues: { note_date: todayISO(), body: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ note_date: todayISO(), body: "" });
    }
  }, [open, form]);

  const addNoteMut = useMutation({
    mutationFn: (values: ContactNoteFormValues) =>
      addContactNote(contactId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.notes(contactId) });
      toast.success("Note added");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add note"),
  });

  const onSubmit = form.handleSubmit((values) => addNoteMut.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>
            Log an interaction or incident. Notes are append-only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note_date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input
              id="note_date"
              type="date"
              {...form.register("note_date")}
            />
            {form.formState.errors.note_date ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.note_date.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body" className="text-xs text-muted-foreground">
              Note
            </Label>
            <Textarea
              id="body"
              rows={4}
              placeholder="Spoke with Ahmet about delayed shipment…"
              {...form.register("body")}
            />
            {form.formState.errors.body ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.body.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={addNoteMut.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addNoteMut.isPending}>
              {addNoteMut.isPending ? "Saving…" : "Add note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
