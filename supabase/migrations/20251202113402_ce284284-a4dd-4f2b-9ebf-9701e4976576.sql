-- Добавляем колонки для хранения дат платежей и выплат
ALTER TABLE public.agents
ADD COLUMN payment_month_1_date DATE,
ADD COLUMN payment_month_2_date DATE,
ADD COLUMN payment_month_3_date DATE,
ADD COLUMN payout_1_date DATE,
ADD COLUMN payout_2_date DATE,
ADD COLUMN payout_3_date DATE;