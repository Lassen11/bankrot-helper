-- Обновляем триггер для логирования изменения статуса is_completed
CREATE OR REPLACE FUNCTION public.log_payment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Проверяем изменение custom_amount
  IF (OLD.custom_amount IS DISTINCT FROM NEW.custom_amount) THEN
    INSERT INTO public.payment_history (payment_id, client_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      NEW.client_id,
      NEW.user_id,
      'custom_amount',
      COALESCE(OLD.custom_amount::TEXT, 'NULL'),
      COALESCE(NEW.custom_amount::TEXT, 'NULL')
    );
  END IF;

  -- Проверяем изменение due_date
  IF (OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
    INSERT INTO public.payment_history (payment_id, client_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      NEW.client_id,
      NEW.user_id,
      'due_date',
      OLD.due_date::TEXT,
      NEW.due_date::TEXT
    );
  END IF;

  -- Проверяем изменение account
  IF (OLD.account IS DISTINCT FROM NEW.account) THEN
    INSERT INTO public.payment_history (payment_id, client_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      NEW.client_id,
      NEW.user_id,
      'account',
      COALESCE(OLD.account, 'NULL'),
      COALESCE(NEW.account, 'NULL')
    );
  END IF;

  -- Проверяем изменение is_completed (статус платежа)
  IF (OLD.is_completed IS DISTINCT FROM NEW.is_completed) THEN
    INSERT INTO public.payment_history (payment_id, client_id, changed_by, field_name, old_value, new_value)
    VALUES (
      NEW.id,
      NEW.client_id,
      NEW.user_id,
      'is_completed',
      OLD.is_completed::TEXT,
      NEW.is_completed::TEXT
    );
  END IF;

  RETURN NEW;
END;
$function$;