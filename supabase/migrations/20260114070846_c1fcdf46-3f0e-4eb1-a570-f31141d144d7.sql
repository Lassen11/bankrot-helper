-- Fix RLS: allow admins to insert payments for any employee/client
-- Current INSERT policy is restrictive and blocks admin-created rows when user_id != auth.uid().

DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;

CREATE POLICY "Users can create their own payments or admins can create all"
ON public.payments
FOR INSERT
WITH CHECK ((auth.uid() = user_id) OR is_admin());
