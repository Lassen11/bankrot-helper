-- Создаём функцию для отправки sync_summary при изменении платежей
CREATE OR REPLACE FUNCTION public.notify_pnltracker_payment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_payments_sum numeric;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Вычисляем общую сумму всех завершенных платежей
  SELECT COALESCE(SUM(COALESCE(custom_amount, original_amount)), 0)
  INTO total_payments_sum
  FROM payments
  WHERE is_completed = true;

  -- Формируем payload для отправки
  payload := jsonb_build_object(
    'event_type', 'sync_summary',
    'total_payments', total_payments_sum,
    'company', 'Спасение',
    'user_id', COALESCE(NEW.user_id, OLD.user_id)::text,
    'date', NOW()::text
  );

  -- Отправляем асинхронный HTTP запрос через pg_net
  SELECT net.http_post(
    url := 'https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/send-to-pnltracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZHZweHhmZ3ZpdmpiemZweGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxOTUzNjUsImV4cCI6MjA3Mzc3MTM2NX0.-7bkvxCdCfz49sJcXXhxOxE_DyhDW-bD6xae933oz_g'
    ),
    body := payload
  ) INTO request_id;

  RAISE LOG 'Sent sync_summary to pnltracker, request_id: %, total_payments: %', request_id, total_payments_sum;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Создаём триггер для отправки sync_summary при завершении платежей
DROP TRIGGER IF EXISTS trigger_notify_pnltracker_payment_sync ON payments;
CREATE TRIGGER trigger_notify_pnltracker_payment_sync
AFTER INSERT OR UPDATE OF is_completed, custom_amount, original_amount ON payments
FOR EACH ROW
WHEN (NEW.is_completed = true)
EXECUTE FUNCTION public.notify_pnltracker_payment_sync();