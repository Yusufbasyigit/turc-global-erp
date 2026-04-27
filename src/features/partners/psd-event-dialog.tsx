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

import {
  createPsdEvent,
  deletePsdEvent,
  updatePsdEvent,
  type PsdLegInput,
} from "./mutations/psd-events";
import { psdKeys, type PsdEventWithLegs } from "./queries/psd-summary";

type LegDraft = {
  key: string;
  id?: string;
  currency: BalanceCurrency | "";
  from_account_id: string;
  amount: string;
};

const FISCAL_PERIOD_MODES = ["none", "year", "quarter", "month"] as const;
type FiscalPeriodMode = (typeof FISCAL_PERIOD_MODES)[number];
const FISCAL_MODE_LABEL: Record<FiscalPeriodMode, string> = {
  none: "None",
  year: "Year",
  quarter: "Quarter",
  month: "Month",
};

function newLegKey(): string {
  return `leg_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyLeg(): LegDraft {
  return {
    key: newLegKey(),
    currency: "",
    from_account_id: "",
    amount: "",
  };
}

function parseFiscalPeriod(value: string | null): {
  mode: FiscalPeriodMode;
  year: string;
  quarter: string;
  month: string;
} {
  if (!value) return { mode: "none", year: "", quarter: "", month: "" };
  const yearOnly = value.match(/^(\d{4})$/);
  if (yearOnly) {
    return { mode: "year", year: yearOnly[1], quarter: "", month: "" };
  }
  const quarter = value.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) {
    return {
      mode: "quarter",
      year: quarter[1],
      quarter: quarter[2],
      month: "",
    };
  }
  const month = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (month) {
    return { mode: "month", year: month[1], quarter: "", month: month[2] };
  }
  return { mode: "none", year: "", quarter: "", month: "" };
}

function buildFiscalPeriod(parts: {
  mode: FiscalPeriodMode;
  year: string;
  quarter: string;
  month: string;
}): string | null {
  if (parts.mode === "none") return null;
  if (!parts.year) return null;
  if (parts.mode === "year") return parts.year;
  if (parts.mode === "quarter" && parts.quarter) {
    return `${parts.year}-Q${parts.quarter}`;
  }
  if (parts.mode === "month" && parts.month) {
    return `${parts.year}-${parts.month}`;
  }
  return null;
}

export function PsdEventDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: PsdEventWithLegs | null;
}) {
  const isEdit = event !== null;
  const queryClient = useQueryClient();

  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
  });
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);

  const [eventDate, setEventDate] = useState<string>(todayDateString());
  const [note, setNote] = useState<string>("");
  const [fiscalMode, setFiscalMode] = useState<FiscalPeriodMode>("none");
  const [fiscalYear, setFiscalYear] = useState<string>("");
  const [fiscalQuarter, setFiscalQuarter] = useState<string>("");
  const [fiscalMonth, setFiscalMonth] = useState<string>("");
  const [legs, setLegs] = useState<LegDraft[]>([emptyLeg()]);

  useEffect(() => {
    if (!open) return;
    if (event) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventDate(event.event_date);
      setNote(event.note ?? "");
      const parts = parseFiscalPeriod(event.fiscal_period);
      setFiscalMode(parts.mode);
      setFiscalYear(parts.year);
      setFiscalQuarter(parts.quarter);
      setFiscalMonth(parts.month);
      setLegs(
        event.legs.length > 0
          ? event.legs.map((l) => ({
              key: newLegKey(),
              id: l.id,
              currency: (l.currency as BalanceCurrency) ?? "",
              from_account_id: l.from_account_id ?? "",
              amount: String(l.amount),
            }))
          : [emptyLeg()],
      );
    } else {
      const today = todayDateString();
      setEventDate(today);
      setNote("");
      const yyyy = today.slice(0, 4);
      const mm = today.slice(5, 7);
      setFiscalMode("month");
      setFiscalYear(yyyy);
      setFiscalQuarter(String(Math.ceil(Number(mm) / 3)));
      setFiscalMonth(mm);
      setLegs([emptyLeg()]);
    }
  }, [open, event]);

  const fiscalPeriod = useMemo(
    () =>
      buildFiscalPeriod({
        mode: fiscalMode,
        year: fiscalYear,
        quarter: fiscalQuarter,
        month: fiscalMonth,
      }),
    [fiscalMode, fiscalYear, fiscalQuarter, fiscalMonth],
  );

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const leg of legs) {
      const amt = Number(leg.amount);
      if (!leg.currency || !Number.isFinite(amt) || amt <= 0) continue;
      m.set(leg.currency, (m.get(leg.currency) ?? 0) + amt);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [legs]);

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

  const createMut = useMutation({
    mutationFn: createPsdEvent,
    onSuccess: async () => {
      toast.success("PSD event logged");
      await queryClient.invalidateQueries({ queryKey: psdKeys.all });
      await queryClient.invalidateQueries({
        queryKey: treasuryKeys.movements(),
      });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: updatePsdEvent,
    onSuccess: async () => {
      toast.success("PSD event updated");
      await queryClient.invalidateQueries({ queryKey: psdKeys.all });
      await queryClient.invalidateQueries({
        queryKey: treasuryKeys.movements(),
      });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deletePsdEvent,
    onSuccess: async () => {
      toast.success("PSD event deleted");
      await queryClient.invalidateQueries({ queryKey: psdKeys.all });
      await queryClient.invalidateQueries({
        queryKey: treasuryKeys.movements(),
      });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitting =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const updateLeg = (key: string, patch: Partial<LegDraft>) => {
    setLegs((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Clear account when currency changes since accounts are
        // currency-scoped.
        if (patch.currency && patch.currency !== l.currency) {
          next.from_account_id = "";
        }
        return next;
      }),
    );
  };

  const addLeg = () => setLegs((prev) => [...prev, emptyLeg()]);

  const removeLeg = (key: string) => {
    setLegs((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const onSubmit = () => {
    if (!eventDate) {
      toast.error("Pick an event date");
      return;
    }
    const built: PsdLegInput[] = [];
    for (const leg of legs) {
      const amt = Number(leg.amount);
      if (!leg.currency) {
        toast.error("Each leg needs a currency");
        return;
      }
      if (!leg.from_account_id) {
        toast.error("Each leg needs a source account");
        return;
      }
      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error("Each leg needs a positive amount");
        return;
      }
      built.push({
        id: leg.id,
        currency: leg.currency as BalanceCurrency,
        from_account_id: leg.from_account_id,
        amount: amt,
      });
    }

    const payload = {
      event_date: eventDate,
      fiscal_period: fiscalPeriod,
      note: note.trim() || null,
      legs: built,
    };

    if (isEdit && event) {
      updateMut.mutate({ id: event.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const onDelete = () => {
    if (!event) return;
    if (
      !confirm(
        "Delete this PSD event and reverse the treasury movements? This cannot be undone.",
      )
    ) {
      return;
    }
    deleteMut.mutate(event.id);
  };

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const arr: string[] = [];
    for (let y = now - 3; y <= now + 1; y++) arr.push(String(y));
    return arr;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit PSD event" : "Log PSD"}</DialogTitle>
          <DialogDescription>
            Money paid out from the company to the owners. Each event can span
            multiple currencies and source accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="psd-date">Event date</Label>
              <Input
                id="psd-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fiscal period</Label>
              <div className="grid grid-cols-[auto_1fr_auto] gap-2">
                <Select
                  value={fiscalMode}
                  onValueChange={(v) => setFiscalMode(v as FiscalPeriodMode)}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FISCAL_PERIOD_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {FISCAL_MODE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fiscalMode === "none" ? (
                  <span className="self-center text-sm text-muted-foreground">
                    No period
                  </span>
                ) : (
                  <Select value={fiscalYear} onValueChange={setFiscalYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fiscalMode === "quarter" ? (
                  <Select
                    value={fiscalQuarter}
                    onValueChange={setFiscalQuarter}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="Q" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4"].map((q) => (
                        <SelectItem key={q} value={q}>
                          Q{q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {fiscalMode === "month" ? (
                  <Select value={fiscalMonth} onValueChange={setFiscalMonth}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="Mo" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "01",
                        "02",
                        "03",
                        "04",
                        "05",
                        "06",
                        "07",
                        "08",
                        "09",
                        "10",
                        "11",
                        "12",
                      ].map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              {fiscalPeriod ? (
                <p className="text-xs text-muted-foreground">
                  Saved as <span className="font-mono">{fiscalPeriod}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="psd-note">Note</Label>
            <Textarea
              id="psd-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — e.g. Q1 2026 distribution"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Legs</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLeg}
              >
                <Plus className="mr-1 size-3.5" />
                Add leg
              </Button>
            </div>
            <div className="space-y-2">
              {legs.map((leg) => {
                const accountItems = leg.currency
                  ? (accountItemsByCurrency.get(leg.currency) ?? [])
                  : [];
                return (
                  <div
                    key={leg.key}
                    className="grid grid-cols-[110px_1fr_140px_auto] items-center gap-2 rounded-md border p-2"
                  >
                    <Select
                      value={leg.currency || ""}
                      onValueChange={(v) =>
                        updateLeg(leg.key, {
                          currency: v as BalanceCurrency,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {BALANCE_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Combobox
                      items={accountItems}
                      value={leg.from_account_id || null}
                      onChange={(v) =>
                        updateLeg(leg.key, { from_account_id: v ?? "" })
                      }
                      placeholder={
                        leg.currency
                          ? "Pick a source account"
                          : "Pick currency first"
                      }
                      searchPlaceholder="Search…"
                      emptyMessage="No matching accounts."
                      disabled={!leg.currency}
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={leg.amount}
                      onChange={(e) =>
                        updateLeg(leg.key, { amount: e.target.value })
                      }
                      placeholder="Amount"
                      className="text-right tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLeg(leg.key)}
                      disabled={legs.length <= 1}
                      aria-label="Remove leg"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            {totals.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Total: {totals.length} leg{totals.length === 1 ? "" : "s"} ·{" "}
                {totals
                  .map(([ccy, amt]) => formatCurrency(amt, ccy))
                  .join(" + ")}
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
                Delete event
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
              {isEdit ? "Save changes" : "Log PSD"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
