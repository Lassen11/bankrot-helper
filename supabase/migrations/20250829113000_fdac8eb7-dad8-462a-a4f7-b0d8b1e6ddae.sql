-- Добавляем связь между чеками и платежами
ALTER TABLE public.payment_receipts 
ADD COLUMN payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE;