-- Singleton app_settings table for company letterhead used on PDFs
-- (proforma, shipment statement). Today these strings are hardcoded in the PDF
-- header components; this table makes them editable from the Settings page.
--
-- Singleton pattern: id is a boolean PK with a check constraint forcing it to
-- true, so the table can never hold more than one row. See decisions log entry
-- dated 2026-04-30.
--
-- Seeded with the values currently hardcoded in
-- src/lib/pdf/proforma-pdf-header.tsx so PDFs keep producing identical output
-- before anyone edits Settings.
--
-- Apply with `supabase db push` from the CLI.

create table public.app_settings (
  id            boolean primary key default true check (id = true),
  company_name  text not null,
  address_line1 text not null,
  address_line2 text not null,
  phone         text not null,
  email         text not null,
  updated_time  timestamptz not null default now(),
  updated_by    uuid references auth.users(id)
);

alter table public.app_settings disable row level security;

insert into public.app_settings (
  company_name,
  address_line1,
  address_line2,
  phone,
  email
) values (
  'Turc Global Danışmanlık ve Dış Ticaret LTD. ŞTİ.',
  'Çobançeşme Mah., Sanayi Cad. Vadi Sk. No:5',
  '34196 Bahçelievler · İstanbul · Türkiye',
  '+90 530 927 57 89',
  'info@turcglobal.com'
);
