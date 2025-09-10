-- Добавляем колонку для даты заключения договора
ALTER TABLE public.clients 
ADD COLUMN contract_date date NOT NULL DEFAULT CURRENT_DATE;