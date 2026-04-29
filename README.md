# Turc Global ERP

Internal ERP for Turc Global — finance + logistics in one app. Single-tenant, private to the company.

High-level briefing for Claude Code is in `CLAUDE.md`. Architectural reasoning lives in `treasury.md` (treasury principles) and `decisions.md` (append-only decisions log). This README covers only how to run, maintain, and deploy the code.

## Stack

- **Next.js 16** (App Router, React Compiler, Turbopack dev)
- **TypeScript** (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Editorial Ledger palette — warm-paper light, brick accent; tokens in `src/app/globals.css`)
- **Supabase** via `@supabase/ssr` — magic-link auth, Postgres, Storage
- **Sonner** for toasts, **Lucide** for icons
- Deployed on **Vercel**

Light mode only (no toggle). UI is English.

## Run locally

Requires Node 20+.

```bash
# 1. Install dependencies
npm install

# 2. Create your .env.local from the template
cp .env.local.example .env.local
# Then edit .env.local and paste the real values (Supabase URL, anon key, project ref).

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/login`. Enter your email, click the magic link in your inbox, and you'll land on `/dashboard`.

## Project layout

```
src/
├── app/
│   ├── (app)/              # Authenticated routes (sidebar shell)
│   │   ├── layout.tsx      # Auth-guarded layout with sidebar
│   │   └── <module>/page.tsx   # One per ERP module
│   ├── login/page.tsx      # Magic-link sign-in
│   ├── auth/
│   │   ├── callback/route.ts   # Exchanges code → session
│   │   └── signout/route.ts    # POST to sign out
│   ├── layout.tsx          # Root layout, fonts, Toaster
│   └── page.tsx            # Redirects to /dashboard
├── features/               # Feature-keyed code (queries, mutations, UI)
│   ├── accounts/           # Treasury sub-views per account
│   ├── contacts/           # Customers + suppliers (shared `contacts` table)
│   ├── dashboard/
│   ├── orders/             # Sales orders + proforma
│   ├── partners/           # Partner equity, loans, reimbursements
│   ├── products/
│   ├── profit-loss/
│   ├── real-estate/        # Apr 2026: rentals + sales (second business line)
│   ├── recurring-payments/
│   ├── shipments/          # Logistics + billing
│   ├── tax/                # KDV
│   ├── transactions/
│   └── treasury/           # Custody locations, accounts, FX, prices
├── components/
│   ├── ui/                 # shadcn components (copied, editable)
│   ├── app-sidebar.tsx     # Main nav
│   ├── user-menu.tsx       # Sidebar footer dropdown
│   ├── login-form.tsx      # Client component for magic link
│   └── coming-soon.tsx     # Empty state used by module placeholders
├── lib/
│   ├── supabase/           # Server + browser clients, shared types
│   ├── ledger/             # FIFO allocation, KDV summary, partner reimbursement
│   ├── pdf/                # @react-pdf/renderer documents (French export docs)
│   ├── proforma/
│   ├── shipments/
│   └── utils.ts            # cn() from shadcn
├── types/database.ts       # Generated from Supabase schema (committed)
└── proxy.ts                # Session refresh + auth gate (see note below)
```

### Note on `proxy.ts` vs `middleware.ts`

Next.js 16 renamed the `middleware` file convention to `proxy` (same role, same matcher API — just a different file name and function name). If you're copy-pasting older auth snippets that reference `middleware.ts`, they go in `src/proxy.ts` here and the function is `export async function proxy()`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for the current API.

## Environment variables

All needed vars are listed in `.env.local.example`. Summary:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for the browser) |
| `NEXT_PUBLIC_SITE_URL` | Base URL used for magic-link redirects (localhost or Vercel domain) |
| `SUPABASE_PROJECT_REF` | Short project ID, only read by `npm run db:types` |

For Vercel, paste these into Project Settings → Environment Variables. `SUPABASE_PROJECT_REF` isn't strictly needed in prod (types are generated locally and committed), but keeping it there lets you run `db:types` from any machine that's configured.

## Regenerate TypeScript types from the Supabase schema

The `src/types/database.ts` file is generated from the live Supabase schema — never hand-edited. Run this whenever the DB changes:

```bash
# Once per machine (opens a browser to authenticate the Supabase CLI)
npx supabase login

# Then, from the repo root:
npm run db:types
```

That runs:

```bash
supabase gen types typescript --project-id $SUPABASE_PROJECT_REF --schema public > src/types/database.ts
```

Commit the regenerated file with a clear message (e.g. `chore(types): regen after adding custody_locations.notes`).

## Deploy to Vercel

First-time setup (you only do this once):

1. **Create the GitHub repo**
   - Go to https://github.com/new, name it `turc-global-erp`, set it private, don't initialize with a README/gitignore/license (we already have those).
   - Back in the terminal, in the project root:
     ```bash
     git add -A
     git commit -m "chore: initial backbone scaffold"
     git branch -M main
     git remote add origin git@github.com:<your-username>/turc-global-erp.git
     git push -u origin main
     ```

2. **Import into Vercel**
   - Go to https://vercel.com/new, select the `turc-global-erp` repo.
   - Framework: Next.js (auto-detected). Root directory: `./`. Build/install commands: defaults.
   - **Before hitting Deploy**, expand the "Environment Variables" section and paste:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SITE_URL` — leave blank for now, you'll set it right after the first deploy gives you a URL.
     - `SUPABASE_PROJECT_REF`
   - Deploy. The first build takes ~1–2 min.

3. **After the first deploy, update `NEXT_PUBLIC_SITE_URL`**
   - Copy your Vercel domain (e.g. `https://turc-global-erp.vercel.app`).
   - In Vercel → Settings → Environment Variables, set `NEXT_PUBLIC_SITE_URL` to that value. Redeploy (Settings → Deployments → "…" → Redeploy).

4. **Tell Supabase about your production URL**
   - In the Supabase dashboard → Authentication → URL Configuration:
     - **Site URL**: your Vercel domain.
     - **Redirect URLs**: add `https://<your-vercel-domain>/auth/callback`. Keep `http://localhost:3000/auth/callback` in the list for dev.

After that, magic links land on the right app in both dev and prod.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with autofix |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run db:types` | Regenerate `src/types/database.ts` from the live Supabase schema |

## Database migrations

- SQL lives in `supabase/migrations/` (source of truth). Add a new timestamped file for any schema change.
- Apply with `supabase db push` from the CLI — the CLI prompts for confirmation each time.
- Regenerate types after applying: `npm run db:types` and commit the updated `src/types/database.ts`.

## Out of scope (for now)

- Role-based access — single-tenant, owner-managed; auth gate is enough.
- Dark mode — the warm-paper Editorial Ledger palette is intentional, not a TODO.
