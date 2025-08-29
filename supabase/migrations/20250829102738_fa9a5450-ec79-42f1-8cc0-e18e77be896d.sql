-- Создаем таблицу для индивидуальных платежей
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_number INTEGER NOT NULL,
  original_amount NUMERIC NOT NULL,
  custom_amount NUMERIC,
  due_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  payment_type TEXT NOT NULL DEFAULT 'monthly',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(client_id, payment_number)
);

-- Включаем RLS для таблицы payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Создаем политики RLS для payments
CREATE POLICY "Users can view their own payments" 
ON public.payments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments" 
ON public.payments 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments" 
ON public.payments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Создаем триггер для обновления updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Создаем индексы для производительности
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);