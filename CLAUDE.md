{\rtf1\ansi\ansicpg1252\cocoartf2869
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Turc Global ERP \'97 Claude Code Briefing\
\
You are building an ERP for Turc Global, a Turkish export company.\
Finance + logistics in one app. Single-tenant, private to the company.\
\
## The planning hub is elsewhere\
Strategy, decisions, and data-model reasoning happen in a Claude project,\
not here. This folder is for building. When you find ambiguity:\
- Check `treasury.md` and `decisions.md` first \'97 they are authoritative.\
- If still unclear, ask Yusuf in chat, don't guess.\
\
## Stack (locked)\
- Next.js 14+ App Router, TypeScript strict mode\
- Tailwind CSS + shadcn/ui (copy components into the repo, don't wrap a library)\
- TanStack Query for server state\
- React Hook Form + Zod for forms and validation\
- Supabase (Postgres + Auth + Storage) \'97 project already provisioned\
- Deployed to Vercel\
\
## About Yusuf\
- No coding background. Explain tradeoffs in plain language.\
- Never assume he knows a term. Define it the first time.\
- Show file paths when referring to files. Show commands to run exactly.\
- When a choice has to be made, offer 2-3 options with a recommendation.\
\
## Language\
- UI is English, always.\
- Turkish only for domain terms that don't translate cleanly:\
  Kasa, Ortak, \uc0\u350 irket, Vergi Dairesi, Y\'fckleme Talimat\u305 , KDV.\
- Generated documents (proposals, Y\'fckleme Talimat\uc0\u305 , invoices) may be\
  in other languages later \'97 English, Turkish, French. UI stays English.\
\
## Design\
- Dark mode by default. No light-mode toggle for MVP \'97 single theme.\
- Aesthetic: modern, clean, professional. You pick the palette \'97 not\
  generic-AI-purple. Something that looks like a serious tool.\
- Desktop-first layout. Mobile: responsive enough to view and do\
  simple edits; complex workflows can be desktop-only for now.\
\
## Users\
- MVP is single-user (Yusuf). Auth works, but no roles yet.\
- Later: 2 more partners with equal access. Leave the schema open to it;\
  don't build the UI for it yet.\
\
## Database\
- Schema already exists in Supabase. Do NOT run migrations without\
  Yusuf's explicit approval \'97 he runs SQL himself in the Supabase dashboard.\
- Generate TypeScript types from the live schema using the Supabase CLI.\
- Source-of-truth principle: store quantities in native units. USD values\
  are always computed at display time from snapshots (see treasury.md).\
\
## What you must not do\
- Don't invent features not asked for.\
- Don't edit `treasury.md`, `decisions.md`, or `CLAUDE.md` unless Yusuf\
  says so explicitly.\
- Don't run `supabase db push` or any migration command.\
- Don't install heavy dependency trees when a small util does the job.\
\
## What you should do\
- Ask before major architectural choices.\
- When you make a non-obvious decision while building, tell Yusuf\
  clearly so he can log it in the Claude project's decisions.md.\
- Prefer server components where data is read-only.\
- Keep components under ~200 lines. Split when they grow.}