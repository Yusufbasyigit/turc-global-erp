"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CONTAINER_CAPACITY,
  containerFillSummary,
  isKnownContainer,
  PRACTICAL_LOAD_FACTOR,
} from "@/lib/shipments/dimensions";

import { getShipmentTotals, shipmentKeys } from "./queries";

type Props = {
  shipmentId: string;
  containerType: string | null;
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

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function ShipmentCapacityCardImpl({ shipmentId, containerType }: Props) {
  const totalsQ = useQuery({
    queryKey: shipmentKeys.totals(shipmentId),
    queryFn: () => getShipmentTotals(shipmentId),
  });

  const totals = totalsQ.data;
  const known = isKnownContainer(containerType);
  const fill = known && totals
    ? containerFillSummary(containerType, totals)
    : null;

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Container capacity</h2>
        {known ? (
          <span className="text-[11px] text-muted-foreground">
            {containerType} · {CONTAINER_CAPACITY[containerType].label} ·
            cap. {CONTAINER_CAPACITY[containerType].cbm} m³ /{" "}
            {CONTAINER_CAPACITY[containerType].payloadKg.toLocaleString()} kg
          </span>
        ) : null}
      </div>

      {totalsQ.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !totals ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Metric
            label="Volume"
            primary={`${fmtCbm(totals.cbm)} m³`}
            fill={fill?.fill.cbm ?? null}
            capacity={
              fill ? `${fmtCbm(fill.capacity.cbm)} m³` : null
            }
            tone={
              fill
                ? fill.overCbm
                  ? "over"
                  : fill.tightCbm
                    ? "tight"
                    : "ok"
                : "none"
            }
          />
          <Metric
            label="Weight"
            primary={`${fmtKg(totals.weightKg)} kg`}
            fill={fill?.fill.weightKg ?? null}
            capacity={
              fill ? `${fmtKg(fill.capacity.payloadKg)} kg` : null
            }
            tone={
              fill
                ? fill.overWeight
                  ? "over"
                  : fill.tightWeight
                    ? "tight"
                    : "ok"
                : "none"
            }
          />
        </div>
      )}

      {totals && (totals.linesMissingDimensions > 0 || totals.linesMissingWeight > 0) ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          {totals.linesMissingDimensions > 0 ? (
            <div>
              {totals.linesMissingDimensions} line
              {totals.linesMissingDimensions === 1 ? "" : "s"} missing
              CBM/dimension data — volume undercounts.
            </div>
          ) : null}
          {totals.linesMissingWeight > 0 ? (
            <div>
              {totals.linesMissingWeight} line
              {totals.linesMissingWeight === 1 ? "" : "s"} missing
              weight — payload undercounts.
            </div>
          ) : null}
        </div>
      ) : null}

      {fill && (fill.overCbm || fill.overWeight) ? (
        <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
          Over container capacity:
          {fill.overCbm ? ` volume at ${fmtPct(fill.fill.cbm)}` : ""}
          {fill.overCbm && fill.overWeight ? "," : ""}
          {fill.overWeight ? ` payload at ${fmtPct(fill.fill.weightKg)}` : ""}
          .
        </div>
      ) : null}

      {!known && containerType ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Container type &quot;{containerType}&quot; has no known capacity —
          fill % is not shown.
        </p>
      ) : null}
      {!containerType ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          No container assigned. Set a container type in &quot;Edit
          basics&quot; to see fill against capacity.
        </p>
      ) : null}
    </section>
  );
}

export const ShipmentCapacityCard = memo(ShipmentCapacityCardImpl);

function Metric({
  label,
  primary,
  fill,
  capacity,
  tone,
}: {
  label: string;
  primary: string;
  fill: number | null;
  capacity: string | null;
  tone: "ok" | "tight" | "over" | "none";
}) {
  const pct = fill === null ? null : Math.max(0, fill);
  const barWidth = pct === null ? 0 : Math.min(1, pct);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-base font-semibold tabular-nums">{primary}</span>
      </div>
      {capacity ? (
        <>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                tone === "over" && "bg-rose-500",
                tone === "tight" && "bg-amber-500",
                tone === "ok" && "bg-emerald-500",
              )}
              style={{ width: `${(barWidth * 100).toFixed(1)}%` }}
            />
            {pct !== null && pct > 1 ? (
              <div
                className="-mt-2 h-2 bg-rose-500/40"
                style={{
                  width: `${Math.min(100, (pct - 1) * 100).toFixed(1)}%`,
                }}
              />
            ) : null}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>
              {pct === null ? "—" : fmtPct(pct)} of {capacity}
            </span>
            <span>practical limit ≈ {fmtPct(PRACTICAL_LOAD_FACTOR)}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
