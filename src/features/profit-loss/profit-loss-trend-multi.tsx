"use client";

import { cn } from "@/lib/utils";
import { formatUsd } from "@/features/treasury/fx-utils";

import { useNetPandLTrendBuckets, type TrendBucket } from "./queries";

const W = 720;
const H = 96;
const PAD_X = 16;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;

export function ProfitLossTrendMulti({
  title,
  buckets,
  inProgressKey,
}: {
  title: string;
  buckets: TrendBucket[];
  inProgressKey?: string;
}) {
  const { points, isLoading, isError } = useNetPandLTrendBuckets(buckets);

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">Drawing the trend…</div>
    );
  }
  if (isError) {
    return (
      <div className="text-xs text-muted-foreground">Trend unavailable.</div>
    );
  }

  const values = points.map((p) => p.netUsd ?? 0);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));

  const drawableW = W - PAD_X * 2;
  const drawableH = H - PAD_TOP - PAD_BOTTOM;
  const zeroY = PAD_TOP + drawableH / 2;
  const stepX = points.length > 0 ? drawableW / points.length : 0;
  const barW = Math.max(8, stepX * 0.7);

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={title}
        >
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={zeroY}
            y2={zeroY}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          {points.map((p, i) => {
            const v = p.netUsd ?? 0;
            const isMissing = p.netUsd == null;
            const h = (Math.abs(v) / max) * (drawableH / 2);
            const x = PAD_X + i * stepX + (stepX - barW) / 2;
            const y = v >= 0 ? zeroY - h : zeroY;
            const positive = v >= 0;
            const isActive = p.key === inProgressKey;
            return (
              <g key={p.key}>
                <title>
                  {p.label}
                  {isMissing
                    ? " · USD total unavailable (rate missing in one or more months)"
                    : ` · ${formatUsd(v)}`}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, h)}
                  rx={2}
                  className={cn(
                    "transition-opacity",
                    isMissing
                      ? "fill-muted stroke-muted-foreground/40"
                      : positive
                        ? "fill-emerald-500/80"
                        : "fill-rose-500/80",
                    isActive ? "opacity-100" : "opacity-70",
                  )}
                  strokeWidth={isMissing ? 1 : 0}
                  strokeDasharray={isMissing ? "2 2" : undefined}
                />
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={10}
                  className={cn(
                    "select-none fill-muted-foreground",
                    isActive && "font-semibold fill-foreground",
                  )}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
