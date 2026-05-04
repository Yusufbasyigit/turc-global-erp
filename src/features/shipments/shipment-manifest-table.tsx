"use client";

import { memo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/format-date";

import {
  listShipmentManifestLines,
  shipmentKeys,
  type ShipmentManifestLine,
} from "./queries";

type Props = {
  shipmentId: string;
  invoiceCurrency: string;
};

function fmtCbm(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtKg(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(n: number, unit: string | null): string {
  const q = n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  return unit ? `${q} ${unit}` : q;
}

function packingLabel(line: ShipmentManifestLine): string {
  const upp = line.unitsPerPackage;
  const type = line.packagingType?.trim();
  if (!upp || upp <= 0) return type ?? "—";
  const per = `${upp.toLocaleString()}/${type ? type : "pkg"}`;
  return per;
}

function StatusPill({ status }: { status: ShipmentManifestLine["status"] }) {
  if (status === "new") return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        status === "rolled_over" && "border-amber-300 bg-amber-50 text-amber-900",
        status === "cancelled" && "border-rose-300 bg-rose-50 text-rose-900",
      )}
    >
      {status === "rolled_over" ? "Rolled over" : "Cancelled"}
    </Badge>
  );
}

function ShipmentManifestTableImpl({ shipmentId, invoiceCurrency }: Props) {
  const q = useQuery({
    queryKey: shipmentKeys.manifest(shipmentId),
    queryFn: () => listShipmentManifestLines(shipmentId),
  });

  const lines = q.data ?? [];

  const totals = lines.reduce(
    (acc, l) => {
      acc.qtyLines += 1;
      acc.cbm += l.cbm;
      acc.weightKg += l.weightKg;
      if (l.lineTotal !== null) acc.goods += l.lineTotal;
      if (l.missingDimensions) acc.missingDims += 1;
      if (l.missingWeight) acc.missingWt += 1;
      return acc;
    },
    { qtyLines: 0, cbm: 0, weightKg: 0, goods: 0, missingDims: 0, missingWt: 0 },
  );

  return (
    <section className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-medium">Manifest</h2>
        <span className="text-[11px] text-muted-foreground">
          Every line on this shipment, sorted as on the statement PDF.
        </span>
      </div>

      {q.isLoading ? (
        <div className="p-4">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : lines.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          No lines yet — add an order above to populate the manifest.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-left">Packing</th>
                <th className="px-3 py-2 text-right">Weight (kg)</th>
                <th className="px-3 py-2 text-right">CBM</th>
                <th className="px-3 py-2 text-right">
                  Unit price ({invoiceCurrency})
                </th>
                <th className="px-3 py-2 text-right">
                  Line total ({invoiceCurrency})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => {
                const rowMuted = l.status !== "new";
                const dimAlert = l.missingDimensions || l.missingWeight;
                return (
                  <tr
                    key={l.rowKey}
                    className={cn(
                      "hover:bg-muted/30",
                      dimAlert && "bg-amber-50/40",
                      rowMuted && "text-muted-foreground",
                    )}
                  >
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {l.lineNumber}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Link
                        href={`/orders/${l.orderId}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {l.orderId.slice(0, 8)}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDateOnly(l.orderDate)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn(rowMuted && "line-through")}>
                          {l.productName}
                        </span>
                        {l.status === "rolled_over" && l.rolledOverToShipmentId ? (
                          <span className="text-[10px]">
                            Billed on{" "}
                            <Link
                              href={`/shipments/${l.rolledOverToShipmentId}`}
                              className="text-primary hover:underline"
                            >
                              {l.rolledOverToName ?? "another shipment"}
                            </Link>
                          </span>
                        ) : null}
                        <StatusPill status={l.status} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(l.quantity, l.unit)}
                    </td>
                    <td className="px-3 py-2 text-xs">{packingLabel(l)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        l.missingWeight && "text-amber-800",
                      )}
                    >
                      {l.missingWeight ? "—" : fmtKg(l.weightKg)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        l.missingDimensions && "text-amber-800",
                      )}
                    >
                      {l.missingDimensions ? "—" : fmtCbm(l.cbm)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.unitPrice === null ? "—" : fmtMoney(l.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.lineTotal === null ? "—" : fmtMoney(l.lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/30 text-xs">
              <tr>
                <td className="px-3 py-2 font-medium" colSpan={3}>
                  {totals.qtyLines} line{totals.qtyLines === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtKg(totals.weightKg)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtCbm(totals.cbm)}
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtMoney(totals.goods)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {(totals.missingDims > 0 || totals.missingWt > 0) && lines.length > 0 ? (
        <div className="border-t bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
          Rows highlighted in amber are missing dimension or weight data on
          their product — totals undercount until those product specs are
          filled in.
        </div>
      ) : null}
    </section>
  );
}

export const ShipmentManifestTable = memo(ShipmentManifestTableImpl);
