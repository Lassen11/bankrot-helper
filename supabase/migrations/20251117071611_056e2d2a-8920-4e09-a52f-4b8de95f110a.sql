-- Обновляем функцию для отправки sync_summary с фильтрацией по месяцу
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
  payment_month date;
  month_start date;
  month_end date;
BEGIN
  -- Определяем месяц платежа и нормализуем к последнему дню месяца
  payment_month := DATE_TRUNC('month', COALESCE(NEW.due_date, OLD.due_date))::date;
  month_start := payment_month;
  month_end := (payment_month + INTERVAL '1 month - 1 day')::date;

  -- Вычисляем общую сумму завершенных платежей за этот месяц
  SELECT COALESCE(SUM(COALESCE(custom_amount, original_amount)), 0)
  INTO total_payments_sum
  FROM payments
  WHERE is_completed = true
    AND due_date >= month_start
    AND due_date <= month_end;

  -- Формируем payload для отправки с датой последнего дня месяца
  payload := jsonb_build_object(
    'event_type', 'sync_summary',
    'total_payments', total_payments_sum,
    'company', 'Спасение',
    'user_id', COALESCE(NEW.user_id, OLD.user_id)::text,
    'date', month_end::text
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

  RAISE LOG 'Sent sync_summary to pnltracker for month %, request_id: %, total_payments: %', month_end, request_id, total_payments_sum;

  RETURN COALESCE(NEW, OLD);
END;
$$;