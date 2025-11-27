-- Создаем таблицу для истории изменений платежей
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Политики доступа - только администраторы могут просматривать историю
CREATE POLICY "Admins can view payment history"
ON public.payment_history
FOR SELECT
TO authenticated
USING (is_admin());

-- Создаем функцию для логирования изменений платежей
CREATE OR REPLACE FUNCTION public.log_payment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN NEW;
END;
$$;

-- Создаем триггер для автоматического логирования изменений
CREATE TRIGGER payment_changes_trigger
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_changes();

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_payment_history_payment_id ON public.payment_history(payment_id);
CREATE INDEX idx_payment_history_client_id ON public.payment_history(client_id);
CREATE INDEX idx_payment_history_changed_at ON public.payment_history(changed_at DESC);