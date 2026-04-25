"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { BALANCE_CURRENCIES } from "@/lib/supabase/types";

export type PartnerLedgerFilterState = {
  fromDate: string;
  toDate: string;
  kinds: string[];
  currencies: string[];
};

const PARTNER_LEDGER_KIND_LABELS: Record<string, string> = {
  partner_loan_in: "Loan in",
  partner_loan_out: "Loan out / reimbursement payout",
  profit_distribution: "Profit distribution",
  expense: "Partner-paid expense",
  adjustment: "Adjustment",
};

const PARTNER_LEDGER_KIND_ORDER = [
  "partner_loan_in",
  "partner_loan_out",
  "profit_distribution",
  "expense",
  "adjustment",
];

export function PartnerLedgerFilters({
  state,
  showCurrencyFilter,
  onChange,
  onReset,
}: {
  state: PartnerLedgerFilterState;
  showCurrencyFilter: boolean;
  onChange: (next: PartnerLedgerFilterState) => void;
  onReset: () => void;
}) {
  const kindItems = PARTNER_LEDGER_KIND_ORDER.map((k) => ({
    value: k,
    label: PARTNER_LEDGER_KIND_LABELS[k] ?? k,
  }));

  const currencyItems = BALANCE_CURRENCIES.map((c) => ({
    value: c,
    label: c,
  }));

  const kindLabel =
    state.kinds.length === 0
      ? "All kinds"
      : state.kinds.length === 1
        ? PARTNER_LEDGER_KIND_LABELS[state.kinds[0]] ?? state.kinds[0]
        : `${state.kinds.length} selected`;

  const currencyLabel =
    state.currencies.length === 0
      ? "All currencies"
      : state.currencies.length === 1
        ? state.currencies[0]
        : `${state.currencies.length} selected`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label
          htmlFor="partner-ledger-from"
          className="block text-[10px] uppercase text-muted-foreground"
        >
          From
        </label>
        <input
          id="partner-ledger-from"
          type="date"
          value={state.fromDate}
          onChange={(e) => onChange({ ...state, fromDate: e.target.value })}
          className="mt-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label
          htmlFor="partner-ledger-to"
          className="block text-[10px] uppercase text-muted-foreground"
        >
          To
        </label>
        <input
          id="partner-ledger-to"
          type="date"
          value={state.toDate}
          onChange={(e) => onChange({ ...state, toDate: e.target.value })}
          className="mt-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div className="w-56">
        <label className="block text-[10px] uppercase text-muted-foreground">
          Kind
        </label>
        <Combobox
          items={kindItems}
          value={state.kinds[0] ?? null}
          onChange={(v) => {
            if (!v) onChange({ ...state, kinds: [] });
            else if (state.kinds.includes(v))
              onChange({ ...state, kinds: state.kinds.filter((k) => k !== v) });
            else onChange({ ...state, kinds: [...state.kinds, v] });
          }}
          placeholder={kindLabel}
          searchPlaceholder="Filter kind…"
          emptyMessage="No kinds"
        />
      </div>
      {showCurrencyFilter ? (
        <div className="w-40">
          <label className="block text-[10px] uppercase text-muted-foreground">
            Currency
          </label>
          <Combobox
            items={currencyItems}
            value={state.currencies[0] ?? null}
            onChange={(v) => {
              if (!v) onChange({ ...state, currencies: [] });
              else if (state.currencies.includes(v))
                onChange({
                  ...state,
                  currencies: state.currencies.filter((c) => c !== v),
                });
              else
                onChange({
                  ...state,
                  currencies: [...state.currencies, v],
                });
            }}
            placeholder={currencyLabel}
            searchPlaceholder="Filter currency…"
            emptyMessage="No currencies"
          />
        </div>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

export { PARTNER_LEDGER_KIND_LABELS };
