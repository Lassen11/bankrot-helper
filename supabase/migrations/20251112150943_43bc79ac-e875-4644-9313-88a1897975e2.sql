-- Add new fields to clients table
ALTER TABLE public.clients 
ADD COLUMN city text,
ADD COLUMN source text,
ADD COLUMN manager text;