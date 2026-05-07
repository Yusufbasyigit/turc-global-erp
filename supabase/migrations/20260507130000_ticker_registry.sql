-- Ticker registry: catalogue of every ticker we know how to price, by provider.
-- Lets the account form offer a real dropdown of ~3000 cryptos (and, in a
-- follow-up, ~600 TEFAS funds) instead of a free-text input that silently
-- accepts mistyped tickers. Also lets the rate-refresh job resolve any
-- account's asset_code to a provider slug without a hardcoded map.
--
-- Seeded daily by the existing refresh-rates Edge Function (weekday 06:00
-- UTC pg_cron schedule already in place); no new schedule needed.

create table public.ticker_registry (
  provider text not null check (provider in ('coinpaprika', 'tefas')),
  code text not null,                                    -- ticker symbol, e.g. BTC, PAXG, KTJ
  slug text not null,                                    -- provider's internal id, e.g. btc-bitcoin
  name text not null,                                    -- full display name, e.g. Bitcoin
  rank integer null,                                     -- popularity hint (lower = more popular); null when provider has no ranking
  last_seen_at timestamptz not null default now(),       -- updated on each refresh; lets us prune dead tickers later
  primary key (provider, code)
);

create index ticker_registry_provider_idx
  on public.ticker_registry (provider);

create index ticker_registry_rank_idx
  on public.ticker_registry (provider, rank nulls last);
