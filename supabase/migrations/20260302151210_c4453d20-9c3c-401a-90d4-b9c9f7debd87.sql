CREATE POLICY "Admins can delete payment history"
ON public.payment_history
FOR DELETE
TO authenticated
USING (is_admin());