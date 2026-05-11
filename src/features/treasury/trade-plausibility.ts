// Sanity check on the implied rate of a `trade` paired movement.
//
// `createPairedMovement` already blocks cross-currency `transfer` because the
// two legs of a transfer must be the same asset. `trade` legitimately crosses
// assets (USD → Altın, EUR → BTC, …) so the same equality check would be
// wrong — but the lack of any check means a typo on the destination quantity
// (e.g. `100` instead of `1000`) silently corrupts both balances with no
// hint that the rate is off by 10x.
//
// This helper compares the implied rate (`quantity_to / quantity_from`)
// against the latest market rate derived from `fx_snapshots` (fiat) or
// `price_snapshots` (crypto/metal/fund). If the divergence exceeds the
// configured threshold, the trade is blocked with a message that names both
// rates. When either side lacks a snapshot (cold start, never-priced asset)
// the helper returns `no_snapshot` and the caller falls through with no
// check — better to permit an un-priceable trade than to block on missing
// data. The implied rate is never persisted; it lives only in the dialog
// preview and the error message.

import type { FxSnapshot, PriceSnapshot } from "@/lib/supabase/types";
import { TRADE_RATE_DIVERGENCE_THRESHOLD } from "./constants";

export type TradeAsset = {
  asset_code: string;
  asset_type: string;
};

export type TradePlausibility =
  | {
      status: "ok";
      impliedRate: number;
      expectedRate: number;
      divergence: number;
    }
  | {
      status: "blocked";
      impliedRate: number;
      expectedRate: number;
      divergence: number;
    }
  | {
      status: "no_snapshot";
      impliedRate: number;
      expectedRate: null;
      divergence: null;
    };

export function usdPerUnit(
  asset: TradeAsset,
  fxMap: Map<string, FxSnapshot>,
  priceMap: Map<string, PriceSnapshot>,
): number | null {
  const code = asset.asset_code?.trim();
  if (!code) return null;

  if (asset.asset_type === "fiat") {
    const fx = fxMap.get(code.toUpperCase());
    if (!fx) return null;
    const rate = Number(fx.rate_to_usd);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  const price = priceMap.get(code);
  if (!price) return null;
  const priceCurrency = price.price_currency?.toUpperCase();
  if (!priceCurrency) return null;
  // Price-currency USD is already the answer; for other currencies we need
  // the FX leg to bridge back to USD.
  const priceValue = Number(price.price);
  if (!Number.isFinite(priceValue) || priceValue <= 0) return null;
  if (priceCurrency === "USD") return priceValue;
  const fx = fxMap.get(priceCurrency);
  if (!fx) return null;
  const rate = Number(fx.rate_to_usd);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return priceValue * rate;
}

export function checkTradePlausibility(input: {
  from: TradeAsset;
  to: TradeAsset;
  quantityFrom: number;
  quantityTo: number;
  fxMap: Map<string, FxSnapshot>;
  priceMap: Map<string, PriceSnapshot>;
  threshold?: number;
}): TradePlausibility {
  const threshold = input.threshold ?? TRADE_RATE_DIVERGENCE_THRESHOLD;
  const qFrom = Math.abs(Number(input.quantityFrom));
  const qTo = Math.abs(Number(input.quantityTo));
  if (
    !Number.isFinite(qFrom) ||
    !Number.isFinite(qTo) ||
    qFrom === 0 ||
    qTo === 0
  ) {
    return {
      status: "no_snapshot",
      impliedRate: Number.NaN,
      expectedRate: null,
      divergence: null,
    };
  }
  const impliedRate = qTo / qFrom;

  const usdFrom = usdPerUnit(input.from, input.fxMap, input.priceMap);
  const usdTo = usdPerUnit(input.to, input.fxMap, input.priceMap);
  if (usdFrom === null || usdTo === null) {
    return {
      status: "no_snapshot",
      impliedRate,
      expectedRate: null,
      divergence: null,
    };
  }
  // expectedRate is units of `to` per unit of `from` at market.
  const expectedRate = usdFrom / usdTo;
  if (!Number.isFinite(expectedRate) || expectedRate <= 0) {
    return {
      status: "no_snapshot",
      impliedRate,
      expectedRate: null,
      divergence: null,
    };
  }
  const divergence = Math.abs(impliedRate - expectedRate) / expectedRate;
  if (divergence > threshold) {
    return { status: "blocked", impliedRate, expectedRate, divergence };
  }
  return { status: "ok", impliedRate, expectedRate, divergence };
}

export function formatTradePlausibilityError(input: {
  from: TradeAsset;
  to: TradeAsset;
  impliedRate: number;
  expectedRate: number;
  divergence: number;
  threshold?: number;
}): string {
  const threshold = input.threshold ?? TRADE_RATE_DIVERGENCE_THRESHOLD;
  const pct = (input.divergence * 100).toFixed(0);
  const thresholdPct = (threshold * 100).toFixed(0);
  const implied = formatRate(input.impliedRate);
  const expected = formatRate(input.expectedRate);
  return `Trade rate looks wrong. You entered 1 ${input.from.asset_code} = ${implied} ${input.to.asset_code}, but the latest market rate is roughly 1 ${input.from.asset_code} = ${expected} ${input.to.asset_code} (off by ${pct}%, threshold ${thresholdPct}%). Double-check both quantities; if the rate is genuinely this far off, refresh the rate snapshots or record the trade in two steps.`;
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 1 ? 4 : 8;
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}
