-- Добавляем политику для админов, чтобы они могли видеть все профили
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin());

-- Добавляем политику для админов, чтобы они могли обновлять все профили
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());