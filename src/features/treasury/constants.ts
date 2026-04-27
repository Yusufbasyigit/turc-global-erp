import type {
  AssetType,
  MovementKind,
  OrtakMovementType,
} from "@/lib/supabase/types";

export const FX_STALE_MS = 24 * 60 * 60 * 1000;

export const FX_API_BASE = "https://api.frankfurter.dev/v1";
export const FX_SOURCE = "frankfurter.dev";

export const COINPAPRIKA_API = "https://api.coinpaprika.com/v1";
export const COINPAPRIKA_SOURCE = "coinpaprika.com";

export const GOLD_API_BASE = "https://api.gold-api.com/price";
export const GOLD_API_SOURCE = "gold-api.com";

export const COINPAPRIKA_IDS: Record<string, string> = {
  BTC: "btc-bitcoin",
  ETH: "eth-ethereum",
  USDT: "usdt-tether",
  USDC: "usdc-usd-coin",
  AVAX: "avax-avalanche",
  BNB: "bnb-binance-coin",
  SOL: "sol-solana",
  XRP: "xrp-xrp",
  ADA: "ada-cardano",
  DOGE: "doge-dogecoin",
  MATIC: "matic-polygon",
  DOT: "dot-polkadot",
  TRX: "trx-tron",
  LINK: "link-chainlink",
  LTC: "ltc-litecoin",
  BCH: "bch-bitcoin-cash",
  ATOM: "atom-cosmos",
  SHIB: "shib-shiba-inu",
  XLM: "xlm-stellar",
  NEAR: "near-near-protocol",
};

export const METAL_ASSET_MAP: Record<
  string,
  { metal: "gold" | "silver"; unit: "oz" | "gram" }
> = {
  XAU: { metal: "gold", unit: "oz" },
  XAG: { metal: "silver", unit: "oz" },
  GOLD: { metal: "gold", unit: "oz" },
  SILVER: { metal: "silver", unit: "oz" },
  Altın: { metal: "gold", unit: "gram" },
  "Altın(gr)": { metal: "gold", unit: "gram" },
  Gümüş: { metal: "silver", unit: "gram" },
  "Gümüş(gr)": { metal: "silver", unit: "gram" },
};

export const OZ_TO_GRAM = 31.1034768;

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  opening: "Opening balance",
  deposit: "Deposit",
  withdraw: "Withdraw",
  transfer: "Transfer",
  trade: "Trade",
  adjustment: "Adjustment",
};

export const MOVEMENT_KIND_DESCRIPTIONS: Record<MovementKind, string> = {
  opening: "Seed a holding with its starting quantity.",
  deposit: "Add quantity to a holding (e.g. incoming payment).",
  withdraw: "Remove quantity from a holding (e.g. outgoing payment).",
  transfer: "Move the same asset between two custody locations.",
  trade: "Convert one asset into another (e.g. USD → Altın).",
  adjustment: "Correct a quantity. Sign is taken as entered.",
};

export const SINGLE_LEG_KINDS: MovementKind[] = [
  "opening",
  "deposit",
  "withdraw",
  "adjustment",
];

export const PAIRED_KINDS: MovementKind[] = ["transfer", "trade"];

export const ORTAK_TYPE_LABELS: Record<OrtakMovementType, string> = {
  partner_loan_in: "Partner loan in",
  partner_loan_out: "Partner loan out",
  profit_share: "Profit share",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  fiat: "Fiat",
  credit_card: "Credit card",
  crypto: "Crypto",
  metal: "Metal",
  fund: "Fund",
};
