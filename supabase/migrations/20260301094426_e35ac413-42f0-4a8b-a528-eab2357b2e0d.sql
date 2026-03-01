
ALTER TABLE public.cabinet_messages 
ADD COLUMN is_read_by_employee boolean NOT NULL DEFAULT false,
ADD COLUMN is_read_by_client boolean NOT NULL DEFAULT false;
