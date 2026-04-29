"use client";

import { useMemo } from "react";

import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BALANCE_CURRENCIES,
  KDV_RATES,
  type SupplierSummary,
} from "@/lib/supabase/types";

import type { ProductBatchImport } from "./product-batch-import-schema";

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}

export function autoMatchSupplierId(
  parsedName: string | null,
  suppliers: SupplierSummary[],
): string | null {
  if (!parsedName) return null;
  const target = normalizeName(parsedName);
  if (!target) return null;
  const exact = suppliers.find(
    (s) => s.company_name && normalizeName(s.company_name) === target,
  );
  if (exact) return exact.id;
  const contains = suppliers.find(
    (s) =>
      s.company_name &&
      (normalizeName(s.company_name).includes(target) ||
        target.includes(normalizeName(s.company_name))),
  );
  return contains?.id ?? null;
}

export type ConfirmedProduct = {
  id: string;
  included: boolean;
  product_name: string;
  client_product_name: string | null;
  unit: string | null;
  est_purchase_price: number | null;
  est_currency: (typeof BALANCE_CURRENCIES)[number] | null;
  default_sales_price: number | null;
  sales_currency: (typeof BALANCE_CURRENCIES)[number] | null;
  kdv_rate: (typeof KDV_RATES)[number] | null;
  weight_kg_per_unit: number | null;
  cbm_per_unit: number | null;
  barcode_value: string | null;
  hs_code: string | null;
  category_hint: string | null;
  supplier_sku: string | null;
};

export function makeConfirmedProducts(
  parsed: ProductBatchImport,
): ConfirmedProduct[] {
  return parsed.products.map((p) => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    included: true,
    product_name: p.product_name,
    client_product_name: p.client_product_name,
    unit: p.unit,
    est_purchase_price: p.est_purchase_price,
    est_currency: p.est_currency,
    default_sales_price: p.default_sales_price,
    sales_currency: p.sales_currency,
    kdv_rate: p.kdv_rate,
    weight_kg_per_unit: p.weight_kg_per_unit,
    cbm_per_unit: p.cbm_per_unit,
    barcode_value: p.barcode_value,
    hs_code: p.hs_code,
    category_hint: p.category_hint,
    supplier_sku: p.supplier_sku,
  }));
}

const NULL_TOKEN = "__null__";

function parseNumOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function BatchAddProductsStep3Confirm({
  parsed,
  rows,
  onRowsChange,
  suppliers,
  supplierId,
  onSupplierIdChange,
}: {
  parsed: ProductBatchImport;
  rows: ConfirmedProduct[];
  onRowsChange: (next: ConfirmedProduct[]) => void;
  suppliers: SupplierSummary[];
  supplierId: string | null;
  onSupplierIdChange: (next: string | null) => void;
}) {
  const includedCount = useMemo(
    () => rows.filter((r) => r.included).length,
    [rows],
  );

  const supplierItems = useMemo(
    () =>
      suppliers
        .filter((s) => Boolean(s.company_name))
        .map((s) => ({ value: s.id, label: s.company_name as string })),
    [suppliers],
  );

  const parsedHint = parsed.supplier_name?.trim() || null;

  const update = (id: string, patch: Partial<ConfirmedProduct>) => {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Confirm products</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Edit any field inline. Uncheck rows you don&apos;t want to add.
          Category is not set in batch — fix later via the single-product edit.
        </p>
      </div>

      {/* Header summary */}
      <div className="rounded-md border p-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Supplier:</span>
            <Combobox
              items={supplierItems}
              value={supplierId}
              onChange={onSupplierIdChange}
              placeholder="No supplier"
              searchPlaceholder="Search suppliers…"
              emptyMessage="No suppliers found. Add one from Contacts."
              clearable
              className="h-8 w-[280px]"
            />
            {parsedHint ? (
              <span className="text-muted-foreground italic">
                AI suggested: &ldquo;{parsedHint}&rdquo;
              </span>
            ) : null}
          </div>
          <div>
            <span className="text-muted-foreground">
              {includedCount} of {rows.length} products
            </span>
          </div>
        </div>
      </div>

      {/* Rows table */}
      <div className="max-h-[55vh] overflow-auto rounded-md border">
        <table className="min-w-full divide-y text-sm">
          <thead className="sticky top-0 bg-muted/80 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">✓</th>
              <th className="px-2 py-2 text-left">Product name</th>
              <th className="px-2 py-2 text-left">Unit</th>
              <th className="px-2 py-2 text-right">Purchase</th>
              <th className="px-2 py-2 text-left">Cur.</th>
              <th className="px-2 py-2 text-right">Sales</th>
              <th className="px-2 py-2 text-left">Cur.</th>
              <th className="px-2 py-2 text-left">KDV</th>
              <th className="px-2 py-2 text-right">Weight (kg)</th>
              <th className="px-2 py-2 text-right">CBM</th>
              <th className="px-2 py-2 text-left">Barcode</th>
              <th className="px-2 py-2 text-left">HS code</th>
              <th className="px-2 py-2 text-left">Client name</th>
              <th className="px-2 py-2 text-left">Category hint</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn("align-top", !row.included && "opacity-40")}
              >
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) =>
                      update(row.id, { included: e.target.checked })
                    }
                    className="size-4 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2 min-w-[220px]">
                  <Input
                    value={row.product_name}
                    onChange={(e) =>
                      update(row.id, { product_name: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={row.unit ?? ""}
                    onChange={(e) =>
                      update(row.id, { unit: e.target.value || null })
                    }
                    placeholder="—"
                    className="h-8 w-20 text-xs"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.est_purchase_price ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        est_purchase_price: parseNumOrNull(e.target.value),
                      })
                    }
                    placeholder="—"
                    className="h-8 w-24 text-right text-xs tabular-nums"
                  />
                </td>
                <td className="px-2 py-2">
                  <Select
                    value={row.est_currency ?? NULL_TOKEN}
                    onValueChange={(v) =>
                      update(row.id, {
                        est_currency:
                          v === NULL_TOKEN
                            ? null
                            : (v as (typeof BALANCE_CURRENCIES)[number]),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[78px] text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NULL_TOKEN}>—</SelectItem>
                      {BALANCE_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.default_sales_price ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        default_sales_price: parseNumOrNull(e.target.value),
                      })
                    }
                    placeholder="—"
                    className="h-8 w-24 text-right text-xs tabular-nums"
                  />
                </td>
                <td className="px-2 py-2">
                  <Select
                    value={row.sales_currency ?? NULL_TOKEN}
                    onValueChange={(v) =>
                      update(row.id, {
                        sales_currency:
                          v === NULL_TOKEN
                            ? null
                            : (v as (typeof BALANCE_CURRENCIES)[number]),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[78px] text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NULL_TOKEN}>—</SelectItem>
                      {BALANCE_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-2">
                  <Select
                    value={
                      row.kdv_rate === null ? NULL_TOKEN : String(row.kdv_rate)
                    }
                    onValueChange={(v) =>
                      update(row.id, {
                        kdv_rate:
                          v === NULL_TOKEN
                            ? null
                            : (Number(v) as (typeof KDV_RATES)[number]),
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[68px] text-xs">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NULL_TOKEN}>—</SelectItem>
                      {KDV_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.weight_kg_per_unit ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        weight_kg_per_unit: parseNumOrNull(e.target.value),
                      })
                    }
                    placeholder="—"
                    className="h-8 w-20 text-right text-xs tabular-nums"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    step="any"
                    value={row.cbm_per_unit ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        cbm_per_unit: parseNumOrNull(e.target.value),
                      })
                    }
                    placeholder="—"
                    className="h-8 w-20 text-right text-xs tabular-nums"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={row.barcode_value ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        barcode_value: e.target.value || null,
                      })
                    }
                    placeholder="—"
                    className="h-8 w-32 text-xs"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={row.hs_code ?? ""}
                    onChange={(e) =>
                      update(row.id, { hs_code: e.target.value || null })
                    }
                    placeholder="—"
                    className="h-8 w-32 text-xs"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={row.client_product_name ?? ""}
                    onChange={(e) =>
                      update(row.id, {
                        client_product_name: e.target.value || null,
                      })
                    }
                    placeholder="—"
                    className="h-8 w-40 text-xs"
                  />
                </td>
                <td className="px-2 py-2 text-xs text-muted-foreground italic">
                  {row.category_hint ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
