-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule auto-sync-metrics to run every 5 minutes
SELECT cron.schedule(
  'auto-sync-metrics-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/auto-sync-metrics',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);