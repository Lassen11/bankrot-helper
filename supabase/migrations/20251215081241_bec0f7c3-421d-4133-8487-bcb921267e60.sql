CREATE OR REPLACE FUNCTION public.notify_pnltracker_client_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Проверяем изменения в новых полях
  IF (OLD.source IS DISTINCT FROM NEW.source) THEN
    changes := changes || jsonb_build_object(
      'field', 'source',
      'old_value', OLD.source,
      'new_value', NEW.source
    );
    change_detected := true;
  END IF;

  IF (OLD.city IS DISTINCT FROM NEW.city) THEN
    changes := changes || jsonb_build_object(
      'field', 'city',
      'old_value', OLD.city,
      'new_value', NEW.city
    );
    change_detected := true;
  END IF;

  IF (OLD.manager IS DISTINCT FROM NEW.manager) THEN
    changes := changes || jsonb_build_object(
      'field', 'manager',
      'old_value', OLD.manager,
      'new_value', NEW.manager
    );
    change_detected := true;
  END IF;

  IF (OLD.installment_period IS DISTINCT FROM NEW.installment_period) THEN
    changes := changes || jsonb_build_object(
      'field', 'installment_period',
      'old_value', OLD.installment_period,
      'new_value', NEW.installment_period
    );
    change_detected := true;
  END IF;

  IF (OLD.monthly_payment IS DISTINCT FROM NEW.monthly_payment) THEN
    changes := changes || jsonb_build_object(
      'field', 'monthly_payment',
      'old_value', OLD.monthly_payment,
      'new_value', NEW.monthly_payment
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
      'source', NEW.source,
      'city', NEW.city,
      'manager', NEW.manager,
      'installment_period', NEW.installment_period,
      'monthly_payment', NEW.monthly_payment,
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
$function$