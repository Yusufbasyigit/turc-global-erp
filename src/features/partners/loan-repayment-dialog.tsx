"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
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

import { recordRepayment } from "./mutations/loans";
import { loansKeys } from "./queries/loans";
import { partnerDetailKeys } from "./queries/partner-transactions";

export type LoanRepaymentPrefill = {
  partner_id: string;
  currency: BalanceCurrency;
};

export function LoanRepaymentDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: LoanRepaymentPrefill | null;
}) {
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
  const [currency, setCurrency] = useState<BalanceCurrency | "">("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    todayDateString(),
  );
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setPartnerId(prefill.partner_id);
      setCurrency(prefill.currency);
    } else {
      setPartnerId("");
      setCurrency("");
    }
    setToAccountId("");
    setAmount("");
    setTransactionDate(todayDateString());
    setDescription("");
  }, [open, prefill]);

  const accountItems = useMemo(() => {
    if (!currency) return [];
    return accounts
      .filter((a) => a.asset_code === currency)
      .map((a) => ({
        value: a.id,
        label: `${a.account_name} · ${a.custody_locations?.name ?? "—"}`,
      }));
  }, [accounts, currency]);

  const partnerItems = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.name })),
    [partners],
  );

  const repayMut = useMutation({
    mutationFn: recordRepayment,
    onSuccess: async () => {
      toast.success("Repayment recorded");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: loansKeys.all }),
        queryClient.invalidateQueries({ queryKey: treasuryKeys.movements() }),
        queryClient.invalidateQueries({ queryKey: partnerDetailKeys.all }),
      ]);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = () => {
    if (!partnerId) return toast.error("Pick a partner");
    if (!currency) return toast.error("Pick a currency");
    if (!toAccountId) return toast.error("Pick a destination account");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return toast.error("Amount must be positive");
    }
    repayMut.mutate({
      partner_id: partnerId,
      currency: currency as BalanceCurrency,
      to_account_id: toAccountId,
      amount: amt,
      transaction_date: transactionDate,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record loan repayment</DialogTitle>
          <DialogDescription>
            Money the partner is paying back. Consumes oldest open
            installments first within partner + currency.
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
              <Label htmlFor="repay-date">Date</Label>
              <Input
                id="repay-date"
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
                  setToAccountId("");
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
              <Label>Destination account</Label>
              <Combobox
                items={accountItems}
                value={toAccountId || null}
                onChange={(v) => setToAccountId(v ?? "")}
                placeholder={
                  currency ? "Pick an account" : "Pick currency first"
                }
                searchPlaceholder="Search…"
                emptyMessage="No matching accounts."
                disabled={!currency}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repay-amount">Amount</Label>
              <Input
                id="repay-amount"
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
            <Label htmlFor="repay-note">Note</Label>
            <Textarea
              id="repay-note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={repayMut.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={repayMut.isPending}
          >
            Record repayment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
