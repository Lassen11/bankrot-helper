-- Создаем таблицу для агентов
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  agent_full_name TEXT NOT NULL,
  agent_phone TEXT NOT NULL,
  recommendation_name TEXT,
  lead_link TEXT,
  mop_name TEXT,
  client_category TEXT,
  first_payment_date DATE,
  reward_amount NUMERIC DEFAULT 0,
  remaining_payment NUMERIC DEFAULT 0,
  first_payment_amount NUMERIC DEFAULT 0,
  payment_month_1 NUMERIC DEFAULT 0,
  payment_month_2 NUMERIC DEFAULT 0,
  payment_month_3 NUMERIC DEFAULT 0,
  payout_1 NUMERIC DEFAULT 0,
  payout_2 NUMERIC DEFAULT 0,
  payout_3 NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создаем таблицу для данных премий сотрудников
CREATE TABLE public.employee_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  reviews_count INTEGER DEFAULT 0,
  agents_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

-- Включаем RLS для agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Политики для agents
CREATE POLICY "Users can view their own agents or admins can view all"
  ON public.agents FOR SELECT
  USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "Users can create their own agents"
  ON public.agents FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Users can update their own agents or admins can update all"
  ON public.agents FOR UPDATE
  USING (auth.uid() = employee_id OR is_admin())
  WITH CHECK (auth.uid() = employee_id OR is_admin());

CREATE POLICY "Users can delete their own agents or admins can delete all"
  ON public.agents FOR DELETE
  USING (auth.uid() = employee_id OR is_admin());

-- Включаем RLS для employee_bonuses
ALTER TABLE public.employee_bonuses ENABLE ROW LEVEL SECURITY;

-- Политики для employee_bonuses
CREATE POLICY "Users can view their own bonuses or admins can view all"
  ON public.employee_bonuses FOR SELECT
  USING (auth.uid() = employee_id OR is_admin());

CREATE POLICY "Users can create their own bonuses"
  ON public.employee_bonuses FOR INSERT
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Users can update their own bonuses or admins can update all"
  ON public.employee_bonuses FOR UPDATE
  USING (auth.uid() = employee_id OR is_admin())
  WITH CHECK (auth.uid() = employee_id OR is_admin());

-- Триггеры для updated_at
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_bonuses_updated_at
  BEFORE UPDATE ON public.employee_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();