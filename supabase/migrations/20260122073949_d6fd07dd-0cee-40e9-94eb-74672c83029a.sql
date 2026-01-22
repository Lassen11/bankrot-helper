-- Удаляем старую политику SELECT для payments
DROP POLICY IF EXISTS "Users can view their own payments or admins can view all" ON public.payments;

-- Создаем новую политику: все авторизованные пользователи могут видеть все платежи
CREATE POLICY "All authenticated users can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (true);