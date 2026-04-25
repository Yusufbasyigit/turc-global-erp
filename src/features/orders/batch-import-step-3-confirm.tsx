"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { hasLineMathMismatch } from "./proforma-helpers";
import type { ProformaImport } from "./proforma-import-schema";

export type ConfirmedLine = {
  id: string;
  line_number: number;
  included: boolean;
  proposed_product_name: string;
  primary_quantity: number;
  primary_unit: string;
  unit_price: number;
  hs_code: string | null;
  line_currency: string | null;
  supplier_sku: string | null;
  secondary_quantities: Record<string, number> | null;
  notes: string | null;
  parsed_line_total: number;
};

export function makeConfirmedLines(parsed: ProformaImport): ConfirmedLine[] {
  return parsed.lines.map((l) => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${l.line_number}-${Math.random().toString(36).slice(2)}`,
    line_number: l.line_number,
    included: true,
    proposed_product_name: l.proposed_product_name,
    primary_quantity: l.primary_quantity,
    primary_unit: l.primary_unit,
    unit_price: l.unit_price,
    hs_code: l.hs_code ?? null,
    line_currency: l.line_currency ?? null,
    supplier_sku: l.supplier_sku ?? null,
    secondary_quantities: l.secondary_quantities ?? null,
    notes: l.notes ?? null,
    parsed_line_total: l.line_total,
  }));
}

function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function BatchImportStep3Confirm({
  parsed,
  lines,
  onLinesChange,
  orderCurrency,
}: {
  parsed: ProformaImport;
  lines: ConfirmedLine[];
  onLinesChange: (next: ConfirmedLine[]) => void;
  orderCurrency: string;
}) {
  const headerCurrency = parsed.currency ?? "—";
  const currencyMismatch =
    !!parsed.currency && parsed.currency !== orderCurrency;

  const includedCount = useMemo(
    () => lines.filter((l) => l.included).length,
    [lines],
  );

  const grandTotal = parsed.totals?.grand_total ?? null;

  const updateLine = (id: string, patch: Partial<ConfirmedLine>) => {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Confirm lines</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Edit any field inline. Uncheck rows you don&apos;t want to add.
        </p>
      </div>

      {/* Header summary */}
      <div className="rounded-md border p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>
            <span className="text-muted-foreground">From: </span>
            <span className="font-medium">
              {parsed.supplier_name ?? "Unknown supplier"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Currency: </span>
            <span className="font-medium">{headerCurrency}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {includedCount} of {lines.length} lines
            </span>
          </div>
          {grandTotal !== null ? (
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-medium tabular-nums">
                {grandTotal.toFixed(2)} {parsed.currency ?? ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Currency mismatch banner */}
      {currencyMismatch ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            Proforma currency ({parsed.currency}) differs from order currency (
            {orderCurrency}). Lines will be added at their proforma prices —
            you&apos;ll need to convert manually.
          </div>
        </div>
      ) : null}

      {/* Lines table */}
      <div className="max-h-[50vh] overflow-auto rounded-md border">
        <table className="min-w-full divide-y text-sm">
          <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">✓</th>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Product name</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-left">Unit</th>
              <th className="px-2 py-2 text-right">Unit price</th>
              <th className="px-2 py-2 text-right">Line total</th>
              <th className="px-2 py-2 text-left">HS code</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line) => {
              const lineTotal = line.primary_quantity * line.unit_price;
              const mathWarn = hasLineMathMismatch({
                primary_quantity: line.primary_quantity,
                unit_price: line.unit_price,
                parsed_line_total: line.parsed_line_total,
              });
              return (
                <tr
                  key={line.id}
                  className={cn(
                    "align-top",
                    !line.included && "opacity-40",
                  )}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={line.included}
                      onChange={(e) =>
                        updateLine(line.id, { included: e.target.checked })
                      }
                      className="size-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {line.line_number}
                  </td>
                  <td className="px-2 py-2 min-w-[240px]">
                    <Input
                      value={line.proposed_product_name}
                      onChange={(e) =>
                        updateLine(line.id, {
                          proposed_product_name: e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="any"
                      value={line.primary_quantity}
                      onChange={(e) =>
                        updateLine(line.id, {
                          primary_quantity: parseNum(e.target.value),
                        })
                      }
                      className="h-8 w-20 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.primary_unit}
                      onChange={(e) =>
                        updateLine(line.id, { primary_unit: e.target.value })
                      }
                      className="h-8 w-20 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="any"
                      value={line.unit_price}
                      onChange={(e) =>
                        updateLine(line.id, {
                          unit_price: parseNum(e.target.value),
                        })
                      }
                      className="h-8 w-24 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <span>{lineTotal.toFixed(2)}</span>
                      {mathWarn ? (
                        <span
                          title={mathWarn.message}
                          aria-label={mathWarn.message}
                          className="inline-flex"
                        >
                          <AlertTriangle className="size-3.5 text-amber-500" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.hs_code ?? ""}
                      onChange={(e) =>
                        updateLine(line.id, {
                          hs_code: e.target.value || null,
                        })
                      }
                      placeholder="—"
                      className="h-8 w-32 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
