-- Включаем расширение pg_net для HTTP запросов
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Функция для отправки обновлений клиента в pnltracker
CREATE OR REPLACE FUNCTION notify_pnltracker_client_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changes jsonb := '[]'::jsonb;
  change_detected boolean := false;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Проверяем изменения в ключевых полях
  IF (OLD.contract_amount IS DISTINCT FROM NEW.contract_amount) THEN
    changes := changes || jsonb_build_object(
      'field', 'contract_amount',
      'old_value', OLD.contract_amount,
      'new_value', NEW.contract_amount
    );
    change_detected := true;
  END IF;

  IF (OLD.total_paid IS DISTINCT FROM NEW.total_paid) THEN
    changes := changes || jsonb_build_object(
      'field', 'total_paid',
      'old_value', OLD.total_paid,
      'new_value', NEW.total_paid
    );
    change_detected := true;
  END IF;

  IF (OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid) THEN
    changes := changes || jsonb_build_object(
      'field', 'deposit_paid',
      'old_value', OLD.deposit_paid,
      'new_value', NEW.deposit_paid
    );
    change_detected := true;
  END IF;

  IF (OLD.deposit_target IS DISTINCT FROM NEW.deposit_target) THEN
    changes := changes || jsonb_build_object(
      'field', 'deposit_target',
      'old_value', OLD.deposit_target,
      'new_value', NEW.deposit_target
    );
    change_detected := true;
  END IF;

  IF (OLD.remaining_amount IS DISTINCT FROM NEW.remaining_amount) THEN
    changes := changes || jsonb_build_object(
      'field', 'remaining_amount',
      'old_value', OLD.remaining_amount,
      'new_value', NEW.remaining_amount
    );
    change_detected := true;
  END IF;

  IF (OLD.is_terminated IS DISTINCT FROM NEW.is_terminated) THEN
    changes := changes || jsonb_build_object(
      'field', 'is_terminated',
      'old_value', OLD.is_terminated,
      'new_value', NEW.is_terminated
    );
    change_detected := true;
  END IF;

  IF (OLD.is_suspended IS DISTINCT FROM NEW.is_suspended) THEN
    changes := changes || jsonb_build_object(
      'field', 'is_suspended',
      'old_value', OLD.is_suspended,
      'new_value', NEW.is_suspended
    );
    change_detected := true;
  END IF;

  -- Если есть изменения, отправляем в pnltracker
  IF change_detected THEN
    payload := jsonb_build_object(
      'event_type', 'update_client',
      'client_name', NEW.full_name,
      'contract_amount', NEW.contract_amount,
      'total_paid', NEW.total_paid,
      'deposit_paid', NEW.deposit_paid,
      'deposit_target', NEW.deposit_target,
      'remaining_amount', NEW.remaining_amount,
      'is_terminated', NEW.is_terminated,
      'is_suspended', NEW.is_suspended,
      'termination_reason', NEW.termination_reason,
      'suspension_reason', NEW.suspension_reason,
      'company', 'Спасение',
      'user_id', NEW.employee_id::text,
      'date', NOW()::text,
      'changes', changes
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

    RAISE LOG 'Sent client update to pnltracker, request_id: %, payload: %', request_id, payload;
  END IF;

  RETURN NEW;
END;
$$;

-- Создаем триггер на таблицу clients
DROP TRIGGER IF EXISTS trigger_notify_pnltracker_client_update ON clients;
CREATE TRIGGER trigger_notify_pnltracker_client_update
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN (
    OLD.contract_amount IS DISTINCT FROM NEW.contract_amount OR
    OLD.total_paid IS DISTINCT FROM NEW.total_paid OR
    OLD.deposit_paid IS DISTINCT FROM NEW.deposit_paid OR
    OLD.deposit_target IS DISTINCT FROM NEW.deposit_target OR
    OLD.remaining_amount IS DISTINCT FROM NEW.remaining_amount OR
    OLD.is_terminated IS DISTINCT FROM NEW.is_terminated OR
    OLD.is_suspended IS DISTINCT FROM NEW.is_suspended
  )
  EXECUTE FUNCTION notify_pnltracker_client_update();