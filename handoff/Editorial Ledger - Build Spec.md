# Defter — Editorial Ledger Dashboard
## Claude Code build spec

You are building the **main dashboard** for **Defter**, an accounting app for Turkish small businesses (single-user, personal-use stage). The dashboard is the landing screen after sign-in.

**Stack already in place:** Next.js (App Router), Tailwind CSS, shadcn/ui, Supabase. Use the existing component conventions — don't reinvent.

The visual direction is **"Editorial Ledger"**: a print-newspaper / financial broadsheet metaphor applied to a working accounting tool. It should feel like reading a quietly authoritative financial gazette, not a SaaS dashboard.

A working HTML reference is included in this folder — open `editorial-ledger-reference.html` in a browser to see the target. **Match its layout, hierarchy, and typography exactly.** The CSS in `editorial-ledger-reference.html` is the source of truth for spacing and proportions when in doubt.

---

## 1. Visual identity

### Palette (light mode only for this direction)

Use Tailwind's `oklch()` arbitrary values; or, preferably, add these as CSS variables and reference via `bg-background` / `text-foreground` style tokens.

| Token | Value | Use |
|---|---|---|
| `--bg`         | `oklch(0.97 0.012 80)`              | Page background — warm paper |
| `--panel`      | `oklch(0.985 0.008 80)`             | Cards / topbar |
| `--panel-2`    | `oklch(0.945 0.012 80)`             | Subtle alt fill |
| `--sidebar`    | `oklch(0.94 0.014 80)`              | Sidebar bg |
| `--fg`         | `oklch(0.20 0.02 60)`               | Body text — near-black ink |
| `--muted-fg`   | `oklch(0.45 0.02 60)`               | Secondary text |
| `--dim-fg`     | `oklch(0.62 0.02 60)`               | Tertiary |
| `--border`     | `oklch(0.30 0.03 60 / 0.18)`        | Hairlines |
| `--border-strong` | `oklch(0.30 0.03 60 / 0.32)`     | Section rules |
| `--primary`    | `oklch(0.40 0.05 60)`               | Brand mark / strong emphasis (near-black ink) |
| `--accent`     | `oklch(0.48 0.16 32)`               | Muted brick — for italic emphasis, pull-quote rule |
| `--pos`        | `oklch(0.42 0.10 150)`              | Gains — restrained green |
| `--neg`        | `oklch(0.50 0.16 28)`               | Losses |

No bright accents. No drop shadows on cards (use 1px hairline borders).

### Typography

Three families, each doing one job:

```css
@import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap");
```

| Family | Use | Notes |
|---|---|---|
| **Instrument Serif** (`--serif`) | Masthead, all headings, large numerics in featured stats | Italic variant carries the editorial voice — apply to one word in `<h1>` and `<h2>` headings |
| **Inter** (`--inter`) | Sidebar, topbar, table headers, kickers, dek lines, ledger body | All small UI chrome |
| **IBM Plex Mono** (`--plex`) | Date stamps, page numbers, "VOL/NO" mark | Print-paper details only |

**Sizes & treatments**

- Masthead `h1`: Instrument Serif **44px**, weight 400, `letter-spacing: -0.01em`. One word italicized in `var(--accent)` (e.g. "The Daily *Ledger*").
- Section heads (`h2`): Instrument Serif 22px, weight 400. Italicize one word in `var(--accent)` ("The *Books*", "On *KDV*").
- "Big number" feature (net income hero): Instrument Serif **70px**, weight 400, `letter-spacing: -0.02em`, tabular-nums.
- Sub-stat values: Instrument Serif 26px.
- Kicker / eyebrow / dek: Inter 10.5–12.5px, `text-transform: uppercase`, `letter-spacing: 0.08em`, `--muted-fg`.
- Body / table cells: Inter 12.5px.
- Pull-quote: Instrument Serif **italic** 16px, `border-left: 2px solid var(--accent)`, `padding-left: 14px`.

Always use `font-variant-numeric: tabular-nums` on monetary values.

### Iconography

Use **lucide-react** (already in shadcn). Stroke width **1.75**, never thicker. Icons are sized to match adjacent text — do not bulk them up. No emoji.

### Borders & rules

The "newspaper" feeling comes from rules, not boxes:

- Masthead bottom: `border-bottom: 1.5px solid var(--fg)` — a thicker bottom rule under the title block.
- "Net payable" totals row: `border-top: 2px solid var(--fg); border-bottom: 1px solid var(--fg);` — double-rule like a printed total.
- Inter-section dividers: 1px hairlines using `var(--border)`.
- Two-column body uses a vertical rule between columns: a 1px-wide div with `background: var(--border)`.

---

## 2. Layout

Three regions: sidebar (220px fixed) + main column (`flex: 1`). Main column is `topbar` (48px) + scrolling `content`. Content is **max-width 1100px, centered horizontally** — this is critical, it gives the dashboard a "page" feel rather than a fluid app feel. Outer padding `36px 56px 48px`.

### 2.1 Sidebar (`<aside>` — 220px)

Same structure as the existing app sidebar. Visual changes only:

- Brand mark: 28×28 square, `var(--primary)` bg, white "D" in **Inter weight 700**, border-radius 4px.
- Brand name "Defter" in Instrument Serif 16px, weight 400.
- Brand sub "MUHASEBE" in Inter 10px, uppercase, `letter-spacing: 0.06em`, `--muted-fg`.
- Group labels: Inter 10.5px, uppercase, `letter-spacing: 0.06em`.
- Nav items: Inter 12.5px. Active state = subtle `oklch(from var(--fg) l c h / 0.08)` background.
- User chip at bottom: avatar (initials), name in Inter 12px weight 500, company in Inter 11px muted.

Nav structure (this is the canonical IA — **use these exact group names and labels**):

- **Overview** — Dashboard, Reports
- **Bookkeeping** — Chart of Accounts, Journal Entries, KDV / VAT
- **Trade** — Receivables, Payables, Invoices, Contacts
- **Cash** — Bank Accounts, Cash Box

### 2.2 Topbar (48px)

Single thin row. Left: breadcrumb "Defter · **The Daily Ledger**" in Inter 12px (only "The Daily Ledger" bolded). Center: search input styled as a pill, Inter 12px placeholder. Right: "VOL. III · NO. 115" in IBM Plex Mono 11px, muted — purely decorative, this is the print-paper flavor.

Breadcrumb on other pages should follow the same pattern: `Defter · **{Page name}**`.

### 2.3 Content

Four stacked sections. **Sequence and proportions matter** — do not rearrange:

1. **Masthead** (page title block) — `padding-bottom: 14px; margin-bottom: 22px; border-bottom: 1.5px solid var(--fg);`
2. **Lead** (hero numerics) — `border-bottom: 1px solid var(--border); padding-bottom: 22px; margin-bottom: 22px;`
3. **Columns** (two-up body)
4. **Footer strip**

#### Masthead

Flex row, items align flex-end, justify space-between.

- **Left:** `<h1>` "The Daily *Ledger*" — italic word is the brand-relative noun (here "Ledger"). Below, a "dek" line in Inter 12.5px uppercase tracked: `Books in good standing · {Company} · {Long date}`.
- **Right:** Plex Mono 11px right-aligned. Three lines: `FY 2026 · Q2`, `Period: Apr 01 — Apr 25` (em-dashes, not hyphens), `Last close: Mar 31 2026`. Bold the values, leave labels muted.

#### Lead — feature numeric + 3 sub-stats

`display: grid; grid-template-columns: 2fr 3fr; gap: 28px;`

**Left column: the feature number.**
- Eyebrow "Net income, year to date" in Inter 11px uppercase tracked, muted.
- Big number: Instrument Serif 70px, tabular-nums, e.g. `₺2,143,820`.
- Below: Inter 12.5px delta line, e.g. "**↑ 12.4%** against the same period last year · net margin **34.1%**". Bold both numerics; the up-arrow + percentage in `var(--pos)` if positive.
- Below that, a **pull-quote** — italic Instrument Serif, brick-colored left border. Generate the quote from the period's actual data. Examples: "Operating cash steady at ₺2.94M; receivables aging stable but for three persistent overdue accounts requiring attention this week." This must be data-derived, not lorem.

**Right column: three sub-stats, vertical rules between.**

CSS:
```css
.sub-stats { display: grid; grid-template-columns: repeat(3, 1fr); }
.sub-stats > div { padding-left: 18px; border-left: 1px solid var(--border); }
.sub-stats > div:first-child { border-left: 0; padding-left: 0; }
```

Each stat: kicker (Inter 10.5px upper tracked muted) → value (Instrument Serif 26px, tabular-nums) → note (Inter 11.5px muted).

The three are: **Cash position**, **Receivable**, **Payable**. Notes describe makeup ("4 banks · 1 cash box", "14 open · 3 overdue", "8 invoices · due 14d").

#### Columns — `display: grid; grid-template-columns: 1fr 1px 1fr; gap: 28px;`

Middle 1px column is a vertical rule (`background: var(--border)`).

**Left column: "The *Books*"** (recent journal entries)

- `<h2>` "The *Books*" + kicker "Recent journal entries · April".
- A `<table class="ledger">`. Columns: Reference / Account / Debit (right) / Credit (right).
- Reference cell is two-line: `<div class="nm">JE-0241</div>` then `<div class="meta">{description}</div>` — meta is Instrument Serif 11px italic muted, *not* Inter. This italicized meta line is a defining trait of this direction.
- Debit positive amounts in `var(--pos)`; credits in `var(--neg)`. Em-dash for empty side.
- Row separators: 1px hairline. No header background. No zebra. No hover highlight.
- Show 5 rows. Link "See all" is *not* needed in this direction — it would feel out of register.

**Right column: "On *KDV*"** (Turkish VAT summary)

KDV is the Turkish VAT system. Three rates apply to most small businesses: 20% standard, 10% reduced (food, transport), 1% basic (staples, books). **Always use the lira symbol ₺** before amounts.

- `<h2>` "On *KDV*" + kicker "April declaration · due 26 May 2026".
- A two-column ledger: row label (rate name + sub-line describing what it covers) + a numeric block with two stacked figures: `collected ₺X` (bold, positive color) and `paid ₺Y` (muted).
- Below the table, the **net payable totals row** — full-width, double-ruled (`border-top: 2px solid var(--fg); border-bottom: 1px solid var(--fg);`). Left: "Net payable" in Inter 11px uppercase tracked muted. Right: net figure in Instrument Serif 30px tabular-nums.
- Below the totals, a **trend chart** — small inline 12-month line chart, 380×84px:
  - Solid 1.5px line in `var(--fg)` for revenue.
  - Dashed 1.5px line (`stroke-dasharray: 2 2`) in `var(--accent)` for expenses.
  - Single 1px baseline rule in `var(--border-strong)`.
  - Single-letter month labels along the bottom in Plex Mono 9px ("M J J A S O N D J F M A").
  - Legend below: Inter 11.5px muted, with totals bolded. **No** filled area, **no** gridlines, **no** dots.

#### Footer strip

`margin-top: 22px; border-top: 1px solid var(--border); padding-top: 14px;` — flex row, three children:

- Left: "— Page i —" in Inter 11px muted with `letter-spacing: 0.04em`.
- Center: "Compiled by Defter · double-entry, audited locally".
- Right: timestamp in Plex Mono "25.04.2026 · 09:14".

---

## 3. Component decisions (shadcn/ui mapping)

- **Cards:** Don't use `<Card>` from shadcn. The editorial direction uses ruled regions, not boxed cards. Build divs with hairline borders directly.
- **Tables:** Use shadcn `<Table>` as a starting point but override with a `.ledger` class that strips the default header background and zebra. Keep the semantic markup.
- **Buttons:** Use shadcn `<Button>` `variant="outline"` and `variant="ghost"` only. No filled primary buttons in this dashboard — the page is read-first; create flows are entered from elsewhere.
- **Badges:** Avoid pill badges in this direction. State communicates through *italic Instrument Serif inline*, e.g. "Ege İplik · INV-04223 · *draft*".
- **Charts:** Hand-rolled inline SVG, as in the reference. Don't pull in Recharts here — the chart aesthetic is reductive and Recharts adds chrome we'd have to fight.

---

## 4. Numbers, dates, language

- **Currency:** Turkish lira `₺` symbol, prefix, no space. Thousands separator `,`, decimal `.`. Negatives shown with `−` (minus, not hyphen) prefix and red color, e.g. `−₺18,000`.
- **Dates:** Long form in masthead ("Saturday, 25 April 2026"), short form in tables ("24 Apr"), ISO with dots ("25.04.2026") in the footer timestamp. Match these exactly.
- **Language:** UI is **English** (per product decision), but Turkish accounting domain terms are kept where they're proper nouns: KDV, names of banks (Halk Bankası), supplier/customer names. Don't translate "KDV" to "VAT" in the UI; it's a known Turkish term.
- **Account codes:** 3-digit chart-of-accounts codes (120, 102, 320, 770…) shown before the account name in tables: `120 · Receivables`. Use `·` (middle dot) as separator throughout, never `|` or `/`.

---

## 5. Data this dashboard needs

Build these as Supabase queries / RPCs. **Don't hard-code.** Each card maps to one query. Cache for 30s on the client.

| Region | Query |
|---|---|
| Masthead "Last close" | `MAX(period_end) WHERE closed = true` |
| Lead feature: Net income YTD | Sum of revenue accounts (6xx) − sum of expense accounts (7xx) for current FY |
| Lead delta: YoY % | Same calc for prior FY same period; show `((cur-prev)/prev)*100` |
| Lead pull-quote | Generate from a small set of templates filled with current cash position, AR aging, top concern |
| Cash position | Sum balance across bank accounts (102) + cash box (100) |
| Receivable | Sum of 120 − 121 (allowance), with overdue count from invoice due dates |
| Payable | Sum of 320, with count and 14-day window flag |
| Books column | Last 5 journal entries by `posted_at desc`, joined to first line's account |
| KDV column | Sum of KDV-tagged transactions by rate, current declaration period |
| Trend chart | Monthly revenue + expense rollup, last 12 months |

**Empty states matter.** A new business has no journal entries yet — the "Books" column should render the section heading, then italic Instrument Serif body copy: *"No entries posted this period. Add your first journal from the sidebar."*. Don't render an empty table.

---

## 6. Responsive

Below 900px wide, collapse the columns grid to one column (drop the vertical rule). Below 720px, stack the lead's grid as well (feature first, then sub-stats become a single 3-row list with horizontal rules between). Sidebar collapses to icon-only at <960px (existing app pattern).

The Editorial direction is desktop-first — phone view is acceptable as a graceful fallback, not a primary target.

---

## 7. Accessibility

- All numeric "delta" indicators (↑ 12.4%) must include a `<span class="sr-only">` with "increased by" / "decreased by" — color is decorative.
- Tables must use proper `<thead>` / `<th scope="col">`.
- Pull-quote: wrap in `<blockquote>`, do not use `<div>`.
- Italic accent words in headings: use `<em>`, not `<i>`.
- Color contrast: `--muted-fg` against `--bg` is 4.6:1, fine for body. `--dim-fg` is 3.4:1 — only use it for non-essential decoration (date stamps, single-letter axis labels).

---

## 8. What to look at

- `editorial-ledger-reference.html` — open this in a browser. **Match the layout proportions and visual rhythm to this file.**
- `colors_and_type.css` — original Turc Global system, used as the typography baseline reference (sizes, leading, mono usage).
- `Dashboard Directions.html` — broader context: this is direction **#4** of four explored. Looking at the others helps you understand what was *rejected*: no emerald accent, no terminal density, no SaaS-friendly indigo cards. The editorial direction is the calmest of the four.

---

## 9. Definition of done

- Dashboard renders at 1440×900 matching the reference within 8px on every region.
- All numbers are live from Supabase, not hardcoded.
- Empty-state copy renders for a fresh tenant.
- Lighthouse a11y ≥ 95.
- Zero shadcn `<Card>` usage on this page.
- The Instrument Serif italic accent appears in **exactly two** places per page: the `h1` masthead and each `h2` section head. Not more — overuse kills the effect.

---

## 10. Anti-patterns — do NOT do these

- ❌ Pill-shaped colored badges for status (use italic inline serif instead)
- ❌ Drop-shadowed cards
- ❌ Filled "primary action" buttons on the dashboard
- ❌ Sparkline-inside-KPI-card pattern (that's the SaaS direction, not this one)
- ❌ Emoji
- ❌ Gradient backgrounds anywhere
- ❌ Rounded-corner content boxes — radii are reserved for buttons and inputs (max 7px)
- ❌ Replacing `·` with `|` or `/`
- ❌ Translating "KDV" to "VAT"
- ❌ Adding sections, modules, or "insights" not in this spec — the page is short on purpose
