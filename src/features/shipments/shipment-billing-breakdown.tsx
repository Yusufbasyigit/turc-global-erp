"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LedgerAllocationResult,
  ShipmentAllocation,
} from "@/lib/ledger/fifo-allocation";
import type { ContactLedgerRow } from "@/features/transactions/queries";
import type { Transaction } from "@/lib/supabase/types";
import { PaymentsAppliedTable } from "./payments-applied-table";
import { BillingHistorySummary } from "./billing-history-summary";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ShipmentBillingBreakdown({
  txn,
  allocation,
  fifo,
  ledgerRows,
  currency,
}: {
  txn: Transaction;
  allocation: ShipmentAllocation;
  fifo: LedgerAllocationResult;
  ledgerRows: ContactLedgerRow[];
  currency: string;
}) {
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const billed = allocation.billed_amount;
  const paid = allocation.paid_amount;
  const outstanding = allocation.outstanding_amount;
  const overpay = paid > billed ? paid - billed : 0;

  const hasHistory =
    txn.edited_time != null &&
    txn.created_time != null &&
    new Date(txn.edited_time).getTime() > new Date(txn.created_time).getTime();

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="Billed" value={`${formatMoney(billed)} ${currency}`} />
        <Stat
          label="Paid (FIFO across ledger)"
          value={`${formatMoney(paid)} ${currency}`}
          tone="emerald"
        />
        {outstanding > 0 ? (
          <Stat
            label="Outstanding"
            value={`${formatMoney(outstanding)} ${currency}`}
            tone="rose"
          />
        ) : overpay > 0 ? (
          <Stat
            label="Credit balance"
            value={`${formatMoney(overpay)} ${currency}`}
            tone="emerald"
            pill
          />
        ) : (
          <Stat
            label="Outstanding"
            value={`0.00 ${currency}`}
            tone="emerald"
          />
        )}
      </div>

      {fifo.skipped_events.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-700 bg-amber-950 p-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {fifo.skipped_events.length} ledger event(s) skipped (no frozen FX
            for this currency) — not included in Paid.
          </span>
        </div>
      ) : null}

      <div>
        <Toggle
          open={paymentsOpen}
          onToggle={() => setPaymentsOpen((v) => !v)}
          label="Payments applied to this shipment"
        />
        {paymentsOpen ? (
          <div className="mt-2">
            <PaymentsAppliedTable
              shipmentBillingId={txn.id}
              fifo={fifo}
              ledgerRows={ledgerRows}
              displayCurrency={currency}
            />
          </div>
        ) : null}
      </div>

      {hasHistory ? (
        <div>
          <Toggle
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
            label="Billing history"
          />
          {historyOpen ? (
            <div className="mt-2">
              <BillingHistorySummary
                currentAmount={Number(txn.amount)}
                currency={txn.currency}
                createdTime={txn.created_time}
                editedTime={txn.edited_time}
                createdBy={txn.created_by}
                editedBy={txn.edited_by}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {open ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronRight className="size-3.5" />
      )}
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
  pill,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
  pill?: boolean;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
        ? "text-rose-300"
        : "text-foreground";
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold tabular-nums",
          toneClass,
          pill &&
            "inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
}
