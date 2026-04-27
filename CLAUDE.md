# Turc Global ERP — Claude Code Briefing

You are building an internal ERP for Turc Global, a Turkish export company.
Finance + logistics in one app. Single-tenant, private to the company.
A second business line (real estate rentals/sales) was added in Apr 2026.

## Authoritative context

When you hit ambiguity, read these — in this order — before guessing:

1. `decisions.md` — append-only log of every non-obvious choice (newest at top). This is the most reliable source of "why is it this way."
2. `treasury.md` — quantity-as-source-of-truth principle and custody-location model.
3. The code itself (`src/features/<module>/`).

If still unclear, ask Yusuf in chat.

## Stack (current)

- Next.js 16 App Router (React Compiler, Turbopack dev), TypeScript strict
- Tailwind CSS v4 + shadcn/ui (components copied into `src/components/ui/`)
- TanStack Query for server state; React Hook Form + Zod for forms
- Supabase (`@supabase/ssr`) — Postgres, magic-link auth, Storage
- Sonner for toasts, Lucide for icons, `@react-pdf/renderer` for PDFs
- Deployed on Vercel

Note: Next.js 16 renamed `middleware.ts` → `proxy.ts` (function `proxy()`). Same role, different name.

## About Yusuf

- No coding background. Explain tradeoffs in plain language; define terms the first time.
- Show file paths and exact commands.
- For non-trivial choices, offer 2–3 options with a recommendation.

## Language

- **UI is English-only**, no exception. Even on a Turkish-export tool.
- Turkish kept only for domain terms with no clean translation: Kasa, Ortak, Şirket, Vergi Dairesi, Yükleme Talimatı, KDV.
- Generated PDFs in `src/lib/pdf/` are French (export shipping docs). Stays French.

## Design — Editorial Ledger ("Defter") palette

- **Light mode only.** Warm-paper background (`oklch(0.97 0.012 80)`), near-black ink (`oklch(0.20 0.02 60)`), muted brick accent (`oklch(0.48 0.16 32)`). No dark mode, no toggle.
- Aesthetic: editorial / financial-broadsheet. Instrument Serif for headings, Inter for UI chrome, IBM Plex Mono for stamps and date marks. Restrained palette, hairline rules instead of drop shadows.
- All design tokens live in `src/app/globals.css` under `:root` and bridge into shadcn via the `--background` / `--foreground` / etc. tokens. The `.editorial-*` utility classes (h1, h2, kicker, ledger, bignum, pullquote) carry the editorial typography — use those rather than re-rolling sizes.
- Desktop-first; mobile is responsive enough for viewing and simple edits.

## Database & migrations

- `supabase/migrations/` is the source of truth. Add a new SQL file for any schema change.
- Apply with `supabase db push` from the CLI (Yusuf runs this; the CLI prompts for confirmation each time).
- Regenerate types after schema changes: `npm run db:types` → commits `src/types/database.ts`.
- Storage of values: quantities are stored in **native units**, never as USD-equivalents. USD is computed at display time from FX + price snapshots. See `treasury.md`.

## Decisions log workflow

After completing a module, feature, or significant change, append entries to `decisions.md` for non-obvious decisions.

- Newest entries at the top.
- Format:
  ```
  ## YYYY-MM-DD — <short title>
  **What:** <one or two sentences>
  **Why:** <reasoning>
  **Alternatives:** <what else was considered, why rejected> (omit if N/A)
  ```
- Log only what a future developer would need context on: schema choices, trade-offs between two reasonable options, patterns chosen over alternatives, constraints invisible from the code.
- Skip obvious/boilerplate choices.
- Show the diff to `decisions.md` before committing.

## Working principles

- Prefer server components where data is read-only.
- Keep components under ~200 lines; split when they grow.
- Don't invent features that weren't asked for.
- Don't install heavy dependency trees when a small util does the job.
- Offer to commit at stable checkpoints — Yusuf is new to git, so be proactive about "want me to commit?" when a feature lands.
