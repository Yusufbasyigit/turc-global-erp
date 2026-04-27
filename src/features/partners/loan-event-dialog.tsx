"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

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
import { formatCurrency } from "@/lib/format-money";
import {
  BALANCE_CURRENCIES,
  type BalanceCurrency,
} from "@/lib/supabase/types";
import {
  listAccountsWithCustody,
  treasuryKeys,
} from "@/features/treasury/queries";
import { todayDateString } from "@/features/treasury/fx-utils";
import { listPartnersWithStats, partnerKeys } from "./queries";

import {
  createLoan,
  deleteLoan,
  updateLoan,
  type LoanInstallmentInput,
} from "./mutations/loans";
import { loansKeys, type LoanWithInstallments } from "./queries/loans";
import { pendingReimbursementsKeys } from "./queries/pending-reimbursements";
import { partnerDetailKeys } from "./queries/partner-transactions";

type InstallmentDraft = {
  key: string;
  id?: string;
  due_date: string;
  amount: string;
};

function newKey(): string {
  return `inst_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyInstallment(): InstallmentDraft {
  return { key: newKey(), due_date: "", amount: "" };
}

export function LoanEventDialog({
  open,
  onOpenChange,
  loan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loan: LoanWithInstallments | null;
}) {
  const isEdit = loan !== null;
  const queryClient = useQueryClient();

  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
  });
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);

  const partnersQ = useQuery({
    queryKey: partnerKeys.list(),
    queryFn: listPartnersWithStats,
  });
  const partners = useMemo(
    () =>
      (partnersQ.data ?? []).filter(
        (p) => p.is_active && p.deleted_at === null,
      ),
    [partnersQ.data],
  );

  const [partnerId, setPartnerId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    todayDateString(),
  );
  const [currency, setCurrency] = useState<BalanceCurrency | "">("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [installments, setInstallments] = useState<InstallmentDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    if (loan) {
      setPartnerId(loan.partner_id ?? "");
      setTransactionDate(loan.transaction_date);
      setCurrency((loan.currency as BalanceCurrency) ?? "");
      setFromAccountId(loan.from_account_id ?? "");
      setAmount(String(loan.amount));
      setDescription(loan.description ?? "");
      setInstallments(
        loan.installments.map((i) => ({
          key: newKey(),
          id: i.id,
          due_date: i.due_date,
          amount: String(i.amount),
        })),
      );
    } else {
      setPartnerId("");
      setTransactionDate(todayDateString());
      setCurrency("");
      setFromAccountId("");
      setAmount("");
      setDescription("");
      setInstallments([]);
    }
  }, [open, loan]);

  const accountItemsByCurrency = useMemo(() => {
    const map = new Map<string, { value: string; label: string }[]>();
    for (const acc of accounts) {
      const ccy = acc.asset_code ?? "";
      const list = map.get(ccy) ?? [];
      const custody = acc.custody_locations?.name ?? "—";
      list.push({
        value: acc.id,
        label: `${acc.account_name} · ${custody}`,
      });
      map.set(ccy, list);
    }
    return map;
  }, [accounts]);

  const accountItems = currency
    ? (accountItemsByCurrency.get(currency) ?? [])
    : [];

  const partnerItems = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.name })),
    [partners],
  );

  const installmentTotal = useMemo(() => {
    let sum = 0;
    for (const inst of installments) {
      const n = Number(inst.amount);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return sum;
  }, [installments]);

  const loanAmount = Number(amount);
  const installmentMismatch =
    installments.length > 0 &&
    Number.isFinite(loanAmount) &&
    loanAmount > 0 &&
    Math.abs(installmentTotal - loanAmount) > 0.001;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: loansKeys.all }),
      queryClient.invalidateQueries({ queryKey: treasuryKeys.movements() }),
      queryClient.invalidateQueries({ queryKey: pendingReimbursementsKeys.all }),
      queryClient.invalidateQueries({ queryKey: partnerDetailKeys.all }),
    ]);
  };

  const createMut = useMutation({
    mutationFn: createLoan,
    onSuccess: async () => {
      toast.success("Loan logged");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: updateLoan,
    onSuccess: async () => {
      toast.success("Loan updated");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLoan,
    onSuccess: async () => {
      toast.success("Loan deleted");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitting =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const updateInstallment = (
    key: string,
    patch: Partial<InstallmentDraft>,
  ) => {
    setInstallments((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  };

  const addInstallment = () =>
    setInstallments((prev) => [...prev, emptyInstallment()]);

  const removeInstallment = (key: string) =>
    setInstallments((prev) => prev.filter((i) => i.key !== key));

  const onSubmit = () => {
    if (!partnerId) return toast.error("Pick a partner");
    if (!currency) return toast.error("Pick a currency");
    if (!fromAccountId) return toast.error("Pick a source account");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return toast.error("Loan amount must be positive");
    }

    const builtInstallments: LoanInstallmentInput[] = [];
    for (const inst of installments) {
      if (!inst.due_date) {
        return toast.error("Each installment needs a due date");
      }
      const n = Number(inst.amount);
      if (!Number.isFinite(n) || n <= 0) {
        return toast.error("Each installment needs a positive amount");
      }
      builtInstallments.push({
        id: inst.id,
        due_date: inst.due_date,
        amount: n,
      });
    }

    const payload = {
      partner_id: partnerId,
      transaction_date: transactionDate,
      currency: currency as BalanceCurrency,
      from_account_id: fromAccountId,
      amount: amt,
      description: description.trim() || null,
      installments: builtInstallments,
    };

    if (isEdit && loan) {
      updateMut.mutate({ id: loan.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const onDelete = () => {
    if (!loan) return;
    if (
      !confirm(
        "Delete this loan and reverse the treasury movement? Installments will be removed too. This cannot be undone.",
      )
    ) {
      return;
    }
    deleteMut.mutate(loan.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit loan" : "Log loan"}</DialogTitle>
          <DialogDescription>
            Money loaned by the company to a partner. Outstanding balance is
            principal minus repayments.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Partner</Label>
              <Combobox
                items={partnerItems}
                value={partnerId || null}
                onChange={(v) => setPartnerId(v ?? "")}
                placeholder="Pick a partner"
                searchPlaceholder="Search partners…"
                emptyMessage="No partners."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loan-date">Date</Label>
              <Input
                id="loan-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_160px]">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={currency || ""}
                onValueChange={(v) => {
                  setCurrency(v as BalanceCurrency);
                  setFromAccountId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
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
              <Label>Source account</Label>
              <Combobox
                items={accountItems}
                value={fromAccountId || null}
                onChange={(v) => setFromAccountId(v ?? "")}
                placeholder={
                  currency ? "Pick an account" : "Pick currency first"
                }
                searchPlaceholder="Search…"
                emptyMessage="No matching accounts."
                disabled={!currency}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loan-amount">Amount</Label>
              <Input
                id="loan-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loan-note">Note</Label>
            <Textarea
              id="loan-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Installments (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInstallment}
              >
                <Plus className="mr-1 size-3.5" />
                Add installment
              </Button>
            </div>
            {installments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No schedule. Repayments will draw down the principal directly.
              </p>
            ) : (
              <div className="space-y-2">
                {installments.map((inst) => (
                  <div
                    key={inst.key}
                    className="grid grid-cols-[1fr_140px_auto] items-center gap-2 rounded-md border p-2"
                  >
                    <Input
                      type="date"
                      value={inst.due_date}
                      onChange={(e) =>
                        updateInstallment(inst.key, {
                          due_date: e.target.value,
                        })
                      }
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={inst.amount}
                      onChange={(e) =>
                        updateInstallment(inst.key, {
                          amount: e.target.value,
                        })
                      }
                      placeholder="Amount"
                      className="text-right tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInstallment(inst.key)}
                      aria-label="Remove installment"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {installments.length > 0 && currency ? (
              <p
                className={`text-xs tabular-nums ${
                  installmentMismatch
                    ? "text-amber-700"
                    : "text-muted-foreground"
                }`}
              >
                Schedule total:{" "}
                {formatCurrency(installmentTotal, currency)}
                {installmentMismatch
                  ? ` · doesn't match loan amount ${formatCurrency(
                      loanAmount,
                      currency,
                    )} (will save anyway)`
                  : ""}
              </p>
            ) : null}
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
                Delete loan
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
              {isEdit ? "Save changes" : "Log loan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
