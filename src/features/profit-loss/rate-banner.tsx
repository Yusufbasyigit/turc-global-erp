"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/features/treasury/fx-utils";

import {
  deleteMonthlyFxOverride,
  upsertMonthlyFxOverride,
} from "./mutations";
import { profitLossKeys, type ResolvedRate } from "./queries";
import { periodLabel } from "./profit-loss-month-picker";
import { HistoryDrawer } from "@/features/audit-log/history-drawer";

export function RateBanner({
  period,
  rate,
}: {
  period: string;
  rate: ResolvedRate;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const upsert = useMutation({
    mutationFn: upsertMonthlyFxOverride,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profitLossKeys.overrides() });
      toast.success("Rate override saved.");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteMonthlyFxOverride(period, "TRY"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profitLossKeys.overrides() });
      toast.success("Override cleared.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Clear failed.");
    },
  });

  const isMissing = rate.source === "missing";
  const isOverride = rate.source === "override";
  const isStale = rate.stale;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
        isMissing
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : isOverride
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : isStale
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-border bg-muted/40 text-foreground",
      )}
    >
      <div className="flex items-center gap-3">
        {isMissing ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            <div>
              <strong className="font-semibold">No USD/TRY rate</strong> for{" "}
              {periodLabel(period)}. USD totals are hidden until you set one.
            </div>
          </>
        ) : (
          <div>
            <strong className="font-semibold">
              1 USD = {(rate.displayPerUsd ?? 0).toFixed(2)} TRY
            </strong>
            <span className="ml-2 text-xs opacity-75">
              source: {rate.source}
              {rate.asOf ? ` · ${formatDateShort(rate.asOf)}` : ""}
              {isStale ? " · stale (no rate inside this month)" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <HistoryDrawer
          table="monthly_fx_overrides"
          rowId={`${period}:TRY`}
          label={`${periodLabel(period)} · TRY`}
          variant="icon-sm"
        />
        {isOverride ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Clear override
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {isOverride ? "Edit override" : "Override…"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open ? (
            <OverrideForm
              period={period}
              currentDisplayPerUsd={rate.displayPerUsd}
              onCancel={() => setOpen(false)}
              onSubmit={(values) =>
                upsert.mutate({
                  period,
                  currencyCode: "TRY",
                  ratePerUsd: values.ratePerUsd,
                  note: values.note,
                })
              }
              pending={upsert.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverrideForm({
  period,
  currentDisplayPerUsd,
  onCancel,
  onSubmit,
  pending,
}: {
  period: string;
  currentDisplayPerUsd: number | null;
  onCancel: () => void;
  onSubmit: (v: { ratePerUsd: number; note: string }) => void;
  pending: boolean;
}) {
  const [rateText, setRateText] = useState(
    currentDisplayPerUsd ? currentDisplayPerUsd.toFixed(4) : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(rateText.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number.");
      return;
    }
    setError(null);
    onSubmit({ ratePerUsd: n, note });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Override USD/TRY rate</DialogTitle>
        <DialogDescription>
          Pin a manual rate for {periodLabel(period)}. All TRY entries in this
          month will be re-converted to USD using this rate.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-1.5">
          <Label htmlFor="pl-rate">1 USD = (TRY)</Label>
          <Input
            id="pl-rate"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
            placeholder="39.75"
            autoFocus
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              e.g. 39.75 means 1 USD buys 39.75 TRY.
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pl-note">Note (optional)</Label>
          <Input
            id="pl-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Source / rationale"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save rate"}
        </Button>
      </DialogFooter>
    </form>
  );
}
