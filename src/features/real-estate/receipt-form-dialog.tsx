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
import { Combobox } from "@/components/ui/combobox";
import { todayDateString } from "@/features/treasury/fx-utils";
import {
  listAccountsWithCustody,
  treasuryKeys,
} from "@/features/treasury/queries";
import { transactionKeys } from "@/features/transactions/queries";
import { createReceipt } from "./mutations";
import { realEstateKeys, type DealState } from "./queries";

export type ReceiptPrefill = { deal_id?: string };

export function ReceiptFormDialog({
  open,
  onOpenChange,
  deals,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deals: DealState[];
  prefill?: ReceiptPrefill | null;
}) {
  const queryClient = useQueryClient();

  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
  });
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);

  const [dealId, setDealId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    todayDateString(),
  );
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const deal = deals.find((d) => d.id === dealId) ?? null;
  const currency = deal?.currency ?? "";

  useEffect(() => {
    if (!open) return;
    setDealId(prefill?.deal_id ?? "");
    setTransactionDate(todayDateString());
    setAccountId("");
    setDescription("");
  }, [open, prefill]);

  useEffect(() => {
    if (!deal) {
      setAmount("");
      return;
    }
    const nextUnpaid = deal.allocation.installments.find(
      (i) => i.outstanding > 0.001,
    );
    setAmount(nextUnpaid ? String(nextUnpaid.outstanding) : "");
  }, [dealId, deal]);

  const dealItems = useMemo(
    () =>
      deals.map((d) => ({
        value: d.id,
        label: `${d.label} · ${d.currency}`,
      })),
    [deals],
  );

  const accountItems = useMemo(() => {
    if (!currency) return [];
    return accounts
      .filter((a) => a.asset_code === currency)
      .map((a) => ({
        value: a.id,
        label: `${a.account_name} · ${a.custody_locations?.name ?? "—"}`,
      }));
  }, [accounts, currency]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: realEstateKeys.all }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: treasuryKeys.movements() }),
    ]);
  };

  const createMut = useMutation({
    mutationFn: createReceipt,
    onSuccess: async () => {
      toast.success("Receipt recorded");
      await invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = () => {
    if (!deal) return toast.error("Pick a deal");
    if (!accountId) return toast.error("Pick a destination account");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return toast.error("Amount must be positive");
    }
    createMut.mutate({
      deal_id: deal.id,
      contact_id: deal.contact_id,
      currency: deal.currency as "TRY" | "EUR" | "USD" | "GBP",
      transaction_date: transactionDate,
      amount: n,
      to_account_id: accountId,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record receipt</DialogTitle>
          <DialogDescription>
            Logged as a client_payment linked to the deal — also lands in the
            destination account.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Deal</Label>
            <Combobox
              items={dealItems}
              value={dealId || null}
              onChange={(v) => setDealId(v ?? "")}
              placeholder="Pick a deal"
              searchPlaceholder="Search deals…"
              emptyMessage="No deals."
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="rcpt-date">Date</Label>
              <Input
                id="rcpt-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rcpt-amount">
                Amount {currency ? `(${currency})` : ""}
              </Label>
              <Input
                id="rcpt-amount"
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
            <Label>Destination account</Label>
            <Combobox
              items={accountItems}
              value={accountId || null}
              onChange={(v) => setAccountId(v ?? "")}
              placeholder={currency ? "Pick an account" : "Pick a deal first"}
              searchPlaceholder="Search…"
              emptyMessage="No matching accounts."
              disabled={!currency}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcpt-note">Note</Label>
            <Textarea
              id="rcpt-note"
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
            disabled={createMut.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={createMut.isPending}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
