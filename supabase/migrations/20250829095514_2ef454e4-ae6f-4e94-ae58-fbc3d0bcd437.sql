-- Add new columns to track payments and deposit progress
ALTER TABLE public.clients 
ADD COLUMN total_paid numeric DEFAULT 0,
ADD COLUMN deposit_paid numeric DEFAULT 0,
ADD COLUMN deposit_target numeric DEFAULT 50000;