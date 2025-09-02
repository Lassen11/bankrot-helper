-- Создаем enum для ролей
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- Создаем таблицу ролей пользователей
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'employee',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE (user_id)
);

-- Включаем RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Создаем функцию для проверки роли пользователя
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = user_uuid;
$$;

-- Создаем функцию для проверки является ли пользователь админом
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = user_uuid AND role = 'admin'
    );
$$;

-- RLS политики для user_roles
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Users can view their own role" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update user roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_admin());

-- Обновляем RLS политики для клиентов
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;

CREATE POLICY "Users can view their own clients or admins can view all" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create their own clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients or admins can update all" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own clients or admins can delete all" 
ON public.clients 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());

-- Обновляем RLS политики для платежей
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete their own payments" ON public.payments;

CREATE POLICY "Users can view their own payments or admins can view all" 
ON public.payments 
FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create their own payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments or admins can update all" 
ON public.payments 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own payments or admins can delete all" 
ON public.payments 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());

-- Обновляем RLS политики для чеков
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Users can create their own receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Users can update their own receipts" ON public.payment_receipts;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON public.payment_receipts;

CREATE POLICY "Users can view their own receipts or admins can view all" 
ON public.payment_receipts 
FOR SELECT 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create their own receipts" 
ON public.payment_receipts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts or admins can update all" 
ON public.payment_receipts 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own receipts or admins can delete all" 
ON public.payment_receipts 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());

-- Обновляем триггер для updated_at в user_roles
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Создаем первого админа (этот пользователь должен будет быть создан вручную)
-- Функция для создания первого админа
CREATE OR REPLACE FUNCTION public.create_first_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Проверяем, есть ли уже админы
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        -- Создаем первого админа из первого зарегистрированного пользователя
        INSERT INTO public.user_roles (user_id, role)
        SELECT id, 'admin'::app_role 
        FROM auth.users 
        ORDER BY created_at ASC 
        LIMIT 1
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END;
$$;