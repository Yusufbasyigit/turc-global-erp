"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { todayDateString } from "@/features/treasury/fx-utils";
import { contactKeys, listContacts } from "@/features/contacts/queries";
import {
  BALANCE_CURRENCIES,
  REAL_ESTATE_SUB_TYPES,
  type BalanceCurrency,
  type RealEstateSubType,
} from "@/lib/supabase/types";
import {
  createDeal,
  softDeleteDeal,
  updateDeal,
  type InstallmentInput,
} from "./mutations";
import { realEstateKeys, type DealState } from "./queries";

type InstallmentDraft = {
  key: string;
  id?: string;
  due_date: string;
  expected_amount: string;
};

function newKey(): string {
  return `inst_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyInstallment(): InstallmentDraft {
  return { key: newKey(), due_date: "", expected_amount: "" };
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal: DealState | null;
}) {
  const isEdit = deal !== null;
  const queryClient = useQueryClient();

  const contactsQ = useQuery({
    queryKey: contactKeys.list(),
    queryFn: listContacts,
  });
  const contacts = useMemo(() => contactsQ.data ?? [], [contactsQ.data]);

  const [label, setLabel] = useState("");
  const [subType, setSubType] = useState<RealEstateSubType>("rent");
  const [contactId, setContactId] = useState("");
  const [currency, setCurrency] = useState<BalanceCurrency>("TRY");
  const [startDate, setStartDate] = useState(todayDateString());
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState<InstallmentDraft[]>([
    emptyInstallment(),
  ]);
  const [splitTotal, setSplitTotal] = useState("");
  const [splitCount, setSplitCount] = useState("");

  useEffect(() => {
    if (!open) return;
    if (deal) {
      setLabel(deal.label);
      setSubType(deal.sub_type as RealEstateSubType);
      setContactId(deal.contact_id);
      setCurrency(deal.currency as BalanceCurrency);
      setStartDate(deal.start_date);
      setNotes(deal.notes ?? "");
      setInstallments(
        deal.installments
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((i) => ({
            key: newKey(),
            id: i.id,
            due_date: i.due_date,
            expected_amount: String(i.expected_amount),
          })),
      );
    } else {
      setLabel("");
      setSubType("rent");
      setContactId("");
      setCurrency("TRY");
      setStartDate(todayDateString());
      setNotes("");
      setInstallments([emptyInstallment()]);
    }
    setSplitTotal("");
    setSplitCount("");
  }, [open, deal]);

  const contactItems = useMemo(
    () =>
      contacts.map((c) => ({
        value: c.id,
        label: c.company_name ?? "(unnamed)",
      })),
    [contacts],
  );

  const installmentTotal = useMemo(() => {
    let s = 0;
    for (const i of installments) {
      const n = Number(i.expected_amount);
      if (Number.isFinite(n) && n > 0) s += n;
    }
    return s;
  }, [installments]);

  const updateInst = (key: string, patch: Partial<InstallmentDraft>) => {
    setInstallments((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  };
  const addInst = () =>
    setInstallments((prev) => [...prev, emptyInstallment()]);
  const removeInst = (key: string) =>
    setInstallments((prev) => prev.filter((i) => i.key !== key));

  const applyEqualSplit = () => {
    const total = Number(splitTotal);
    const count = Math.floor(Number(splitCount));
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter a positive total");
      return;
    }
    if (!Number.isFinite(count) || count < 1) {
      toast.error("Enter a positive count");
      return;
    }
    const each = Math.round((total / count) * 100) / 100;
    const remainder = Math.round((total - each * count) * 100) / 100;
    const baseStart = startDate || todayDateString();
    const drafts: InstallmentDraft[] = [];
    for (let i = 0; i < count; i += 1) {
      const d = new Date(`${baseStart}T00:00:00`);
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const amount = i === count - 1 ? each + remainder : each;
      drafts.push({
        key: newKey(),
        due_date: `${yyyy}-${mm}-${dd}`,
        expected_amount: String(amount),
      });
    }
    setInstallments(drafts);
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: realEstateKeys.all });
  };

  const createMut = useMutation({
    mutationFn: createDeal,
    onSuccess: async () => {
      toast.success("Deal created");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateMut = useMutation({
    mutationFn: updateDeal,
    onSuccess: async () => {
      toast.success("Deal updated");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteMut = useMutation({
    mutationFn: softDeleteDeal,
    onSuccess: async () => {
      toast.success("Deal deleted");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitting =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const onSubmit = () => {
    if (!label.trim()) return toast.error("Label is required");
    if (!contactId) return toast.error("Pick a contact");
    if (!currency) return toast.error("Pick a currency");
    if (installments.length === 0) {
      return toast.error("Add at least one installment");
    }
    const built: InstallmentInput[] = [];
    for (const i of installments) {
      if (!i.due_date) return toast.error("Each installment needs a due date");
      const n = Number(i.expected_amount);
      if (!Number.isFinite(n) || n <= 0) {
        return toast.error("Each installment needs a positive amount");
      }
      built.push({ id: i.id, due_date: i.due_date, expected_amount: n });
    }
    const payload = {
      label: label.trim(),
      sub_type: subType,
      contact_id: contactId,
      currency,
      start_date: startDate,
      notes: notes.trim() || null,
      installments: built,
    };
    if (isEdit && deal) {
      updateMut.mutate({ id: deal.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const onDelete = () => {
    if (!deal) return;
    if (!confirm("Delete this deal? This cannot be undone.")) return;
    deleteMut.mutate(deal.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit deal" : "New deal"}</DialogTitle>
          <DialogDescription>
            A real-estate rent or sale agreement with a scheduled installment
            plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div className="space-y-1.5">
              <Label htmlFor="re-label">Label</Label>
              <Input
                id="re-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Şişli daire kira"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={subType}
                onValueChange={(v) => setSubType(v as RealEstateSubType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REAL_ESTATE_SUB_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "rent" ? "Rent" : "Sale"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_140px]">
            <div className="space-y-1.5">
              <Label>Counterparty</Label>
              <Combobox
                items={contactItems}
                value={contactId || null}
                onChange={(v) => setContactId(v ?? "")}
                placeholder="Pick a contact"
                searchPlaceholder="Search contacts…"
                emptyMessage="No contacts."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as BalanceCurrency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="re-start">Start date</Label>
              <Input
                id="re-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="re-notes">Notes</Label>
            <Textarea
              id="re-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Installments</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInst}
              >
                <Plus className="mr-1 size-3.5" />
                Add row
              </Button>
            </div>

            <div className="grid grid-cols-[120px_120px_50px_auto] items-end gap-2 rounded-md border bg-muted/30 p-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Total
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={splitTotal}
                  onChange={(e) => setSplitTotal(e.target.value)}
                  placeholder="0"
                  className="text-right tabular-nums h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Count
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={splitCount}
                  onChange={(e) => setSplitCount(e.target.value)}
                  placeholder="0"
                  className="text-right tabular-nums h-8"
                />
              </div>
              <span className="self-end pb-1 text-xs text-muted-foreground">
                →
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={applyEqualSplit}
                className="self-end"
              >
                <Wand2 className="mr-1 size-3.5" />
                Equal split (monthly)
              </Button>
            </div>

            <div className="space-y-2">
              {installments.map((inst, idx) => (
                <div
                  key={inst.key}
                  className="grid grid-cols-[40px_1fr_140px_auto] items-center gap-2 rounded-md border p-2"
                >
                  <span className="text-xs text-muted-foreground tabular-nums">
                    #{idx + 1}
                  </span>
                  <Input
                    type="date"
                    value={inst.due_date}
                    onChange={(e) =>
                      updateInst(inst.key, { due_date: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={inst.expected_amount}
                    onChange={(e) =>
                      updateInst(inst.key, {
                        expected_amount: e.target.value,
                      })
                    }
                    placeholder="Amount"
                    className="text-right tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInst(inst.key)}
                    aria-label="Remove installment"
                    disabled={installments.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              Schedule total: {installmentTotal.toFixed(2)} {currency}
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={submitting}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={submitting}>
              {isEdit ? "Save changes" : "Create deal"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
