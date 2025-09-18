-- Добавляем поле employee_id в таблицу clients для привязки сотрудников
ALTER TABLE public.clients 
ADD COLUMN employee_id UUID REFERENCES auth.users(id);

-- Копируем существующие значения user_id в employee_id для совместимости
UPDATE public.clients 
SET employee_id = user_id;

-- Создаем индекс для быстрого поиска по сотрудникам
CREATE INDEX idx_clients_employee_id ON public.clients(employee_id);

-- Обновляем RLS политики для работы с сотрудниками
DROP POLICY IF EXISTS "Users can view their own clients or admins can view all" ON public.clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients or admins can update all" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients or admins can delete all" ON public.clients;

-- Новые RLS политики с учетом employee_id
CREATE POLICY "Users can view their assigned clients or admins can view all" 
ON public.clients 
FOR SELECT 
USING ((auth.uid() = employee_id) OR is_admin());

CREATE POLICY "Admins can create clients and assign employees" 
ON public.clients 
FOR INSERT 
WITH CHECK (is_admin() OR (auth.uid() = employee_id));

CREATE POLICY "Users can update their assigned clients or admins can update all" 
ON public.clients 
FOR UPDATE 
USING ((auth.uid() = employee_id) OR is_admin())
WITH CHECK ((auth.uid() = employee_id) OR is_admin());

CREATE POLICY "Admins can delete any clients, users can delete their assigned clients" 
ON public.clients 
FOR DELETE 
USING ((auth.uid() = employee_id) OR is_admin());