-- Изменяем deposit_target на фиксированное значение 70000
ALTER TABLE public.clients 
ALTER COLUMN deposit_target SET DEFAULT 70000;

-- Обновляем существующие записи
UPDATE public.clients 
SET deposit_target = 70000 
WHERE deposit_target IS NULL OR deposit_target != 70000;