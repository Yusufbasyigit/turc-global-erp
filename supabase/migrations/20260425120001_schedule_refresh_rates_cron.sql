-- Schedule the refresh-rates Edge Function to run every weekday at 06:00 UTC
-- (= 09:00 Europe/Istanbul year-round; Turkey is UTC+3 with no DST).
-- Weekday-only: FX markets are closed on weekends, and running the crypto/
-- metal half alone would produce mixed staleness where fiat is older than
-- crypto — more confusing than uniform weekday-fresh state.
--
-- Before applying this migration, seed two Supabase Vault secrets:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/refresh-rates', 'refresh_rates_function_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'refresh-rates-weekday-morning',
  '0 6 * * 1-5',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_rates_function_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
