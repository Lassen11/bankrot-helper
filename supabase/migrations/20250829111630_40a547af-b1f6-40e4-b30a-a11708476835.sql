-- Add payment_day field to clients table
ALTER TABLE public.clients 
ADD COLUMN payment_day INTEGER NOT NULL DEFAULT 1 CHECK (payment_day >= 1 AND payment_day <= 31);