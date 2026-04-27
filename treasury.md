# Treasury & Holdings Module

## Purpose
Track every holding the company touches — cash in multiple currencies, physical gold
and silver, crypto, investment funds — across different custody locations, and show
a unified USD-equivalent view without slowing the app.

---

## Core principle — quantity is the source of truth
Every holding is stored as **quantity in its native unit**, never as a USD-equivalent.

- If Yusuf sells 2 units of KTJ, the app records `-2 KTJ units`, not `-$X`.
- If 1 gram of gold is moved from the office safe to the joint account, it's
  `-1 g Altın (Kasa)` and `+1 g Altın (Ortak)` — the USD value of that gram is
  not part of the transaction.
- USD value is a **display field**, computed on the fly from the latest price
  and FX snapshots. It is never stored as a balance.

This rule prevents drift. Rates change; your physical holdings don't.

---

## Custody locations

| Label  | What it is                                           | Legal ownership        | Physical |
|--------|------------------------------------------------------|------------------------|----------|
| Şirket | Bank account in the company's name (Turc Global)     | Company                | Bank     |
| Ortak  | Joint bank account under the 3 owners' personal names | Personal (joint)       | Bank     |
| Kasa   | Physical safe in the office                           | Company-held           | Physical |

**Note on Ortak:** legally personal-joint but operationally used by the company.
Ortak transactions come in two types — (a) partner loans in/out, and
(b) monthly profit-share distributions. Every transaction on an Ortak holding
must record its *movement type* so the accounting module can post it to the
correct GL account later.

**Additional physical locations:** the office safe (Kasa) is the primary one,
but physical gold may also be held at off-site trusted locations — historically
labelled *GAP 1/4* and *Kasa Çekme* in the sheet. Treat these as additional
custody locations of type "physical." The location list should be editable in
the app, not hardcoded.

---

## Asset types

| Type               | Unit stored     | Examples                          |
|--------------------|-----------------|-----------------------------------|
| Fiat currency      | Currency amount | USD, EUR, TRY, GBP                |
| Precious metals    | Grams           | Altın (gold), Gümüş (silver)      |
| Crypto             | Coin quantity   | BTC, USDT, AVAX                   |
| Investment funds   | Fund units      | KTJ, KPU, KPA, KPC (KT Portföy)   |

---

## Pricing & FX — refresh cadence

This is the rule that keeps the app fast. Everything else follows from it.

| What                         | Source                       | Cadence                                           |
|------------------------------|------------------------------|---------------------------------------------------|
| FX rates (fiat → USD)        | Frankfurter API | **Auto weekdays 09:00 Istanbul + manual button** |
| Fund unit prices (KT funds)  | TEFAS                        | Auto, once per day                                |
| Crypto prices                | CoinGecko (or similar)       | Auto, once per day                                |
| Gold / silver spot           | TBD                          | Auto, once per day                                |

No background timers. No fetches on page load. No per-view rate checks.
The refresh button is the only trigger for FX.

Every displayed USD value is stamped with the date of the FX rate used
(e.g. *"USD view — rates from 21 Apr 2026"*) so stale data is visible, not hidden.
When rates are stale (> 24h since last refresh, threshold tunable), **grey out
the USD column** so the user sees at a glance that a refresh is due.

As of 2026-04-25 there is a weekday-morning auto-refresh of all rate types
via a server-side cron (Supabase Edge Function + pg_cron). The manual button
remains for intraday refreshes and testing. Refresh runs are logged in
`rate_refresh_runs`.
---

## FX has two jobs — don't confuse them

The rules above are about **wallet display** — showing what your
holdings are worth in USD today. That FX is a snapshot applied at
display time, never stored on any balance.

There's a second use of FX elsewhere: **locking a client-facing
amount at the moment a transaction happens.** When a client sends
$30,000 and their balance is kept in EUR, the EUR equivalent on that
day becomes part of the promise you made them. That rate is captured
on the transaction row and frozen — it must not move when the
display rate changes tomorrow.

Short version:
- Treasury display → FX from latest snapshot, computed on the fly.
- Client-balance transactions → FX captured at receipt, stored on
  the row, never recomputed.

Handled in the client-balance / orders module, not treasury.
---

## Data model (sketch)

The app stores four things. Balances and USD views are **computed** from these,
not stored.

**Holdings** — one row per "what you own, where it lives"
*Fields:* asset (USD, BTC, KTJ, Altın…), custody location, running quantity.

**Transactions** — one row per change to a holding
*Fields:* date, holding, type (buy / sell / deposit / withdraw / transfer), quantity, notes.
Transfers create two linked rows (out of one holding, into another).

**Price snapshots** — daily unit prices for non-fiat assets
*Fields:* asset, date, price in TRY (or USD), source (TEFAS, CoinGecko, etc.).

**FX snapshots** — fiat-to-USD rates with a fetch timestamp
*Fields:* currency, date, rate, source, fetched_at.

**USD view formula:** `quantity × latest_price_snapshot × latest_fx_snapshot` — computed at display time.

---

## Operations the UI needs

1. Add a new holding (pick asset + custody location, enter starting quantity).
2. Record a transaction on an existing holding (buy, sell, deposit, withdraw).
3. Transfer between custody locations (e.g. Kasa → Ortak).
4. Refresh FX rates (single button, fetches all fiat → USD rates at once).
5. View holdings grouped by: asset type, custody location, or flat list.
6. Toggle USD-equivalent column on any view (uses latest snapshots).

---

## Resolved decisions

- **Gold sub-locations (GAP 1/4, Kasa Çekme).** Both are physical gold at off-site
  trusted locations. Treated as additional physical custody locations. Location
  list is editable in the app.
- **Zekat feature.** Out of scope for MVP. Revisit once the core of the app works.
- **Spot price source.** Any reliable free API is fine — decision deferred to
  build time in Claude Code. Suggested candidates: metals.live, goldapi.io free tier.
- **Stale-FX UX.** Grey out the USD column when rates are > 24h old. Threshold tunable.
- **Ortak ↔ General Ledger.** Ortak transactions come in two types:
  (a) partner loans in/out, (b) monthly profit-share distributions. Each
  transaction on an Ortak holding must record its *movement type* so the
  accounting module posts to the correct GL account.
- **Account lifecycle.** `accounts` rows have `is_active` (deactivate, hides
  from pickers) and `deleted_at` (soft-delete, hides from registry).
  Balances continue to compute over `treasury_movements` regardless of
  either flag — historical totals don't change when an account is retired.

## Still to decide

- Exact price-source APIs — chosen at build time.
- Grey-out threshold — start with 24h, adjust from real use.
- Whether to add a `transactions` table now (audit trail) or defer to the
  accounting module phase.
