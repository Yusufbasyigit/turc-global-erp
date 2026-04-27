"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { TRANSACTION_KIND_LABELS } from "@/features/transactions/constants";

export type LedgerFilterState = {
  fromDate: string;
  toDate: string;
  kinds: string[];
  shipmentIds: string[];
};

const LEDGER_KINDS = [
  "shipment_billing",
  "client_payment",
  "client_refund",
] as const;

export function LedgerFilters({
  state,
  shipmentOptions,
  onChange,
  onReset,
}: {
  state: LedgerFilterState;
  shipmentOptions: Array<{ id: string; name: string | null }>;
  onChange: (next: LedgerFilterState) => void;
  onReset: () => void;
}) {
  const kindItems = LEDGER_KINDS.map((k) => ({
    value: k,
    label: TRANSACTION_KIND_LABELS[k],
  }));
  const shipmentItems = shipmentOptions.map((s) => ({
    value: s.id,
    label: s.name ?? s.id.slice(0, 8),
  }));

  const activeKindLabel =
    state.kinds.length === 0
      ? "All events"
      : state.kinds.length === 1
        ? TRANSACTION_KIND_LABELS[
            state.kinds[0] as keyof typeof TRANSACTION_KIND_LABELS
          ] ?? state.kinds[0]
        : `${state.kinds.length} selected`;
  const activeShipmentLabel =
    state.shipmentIds.length === 0
      ? "All shipments"
      : state.shipmentIds.length === 1
        ? shipmentOptions.find((s) => s.id === state.shipmentIds[0])?.name ??
          state.shipmentIds[0].slice(0, 8)
        : `${state.shipmentIds.length} selected`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label
          htmlFor="ledger-from"
          className="block text-[10px] uppercase text-muted-foreground"
        >
          From
        </label>
        <input
          id="ledger-from"
          type="date"
          value={state.fromDate}
          onChange={(e) => onChange({ ...state, fromDate: e.target.value })}
          className="mt-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div>
        <label
          htmlFor="ledger-to"
          className="block text-[10px] uppercase text-muted-foreground"
        >
          To
        </label>
        <input
          id="ledger-to"
          type="date"
          value={state.toDate}
          onChange={(e) => onChange({ ...state, toDate: e.target.value })}
          className="mt-1 rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div className="w-48">
        <label className="block text-[10px] uppercase text-muted-foreground">
          Event kind
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
          placeholder={activeKindLabel}
          searchPlaceholder="Filter kind…"
          emptyMessage="No kinds"
        />
      </div>
      {shipmentOptions.length > 0 ? (
        <div className="w-48">
          <label className="block text-[10px] uppercase text-muted-foreground">
            Shipment
          </label>
          <Combobox
            items={shipmentItems}
            value={state.shipmentIds[0] ?? null}
            onChange={(v) => {
              if (!v) onChange({ ...state, shipmentIds: [] });
              else if (state.shipmentIds.includes(v))
                onChange({
                  ...state,
                  shipmentIds: state.shipmentIds.filter((s) => s !== v),
                });
              else
                onChange({
                  ...state,
                  shipmentIds: [...state.shipmentIds, v],
                });
            }}
            placeholder={activeShipmentLabel}
            searchPlaceholder="Filter shipment…"
            emptyMessage="No shipments"
          />
        </div>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
