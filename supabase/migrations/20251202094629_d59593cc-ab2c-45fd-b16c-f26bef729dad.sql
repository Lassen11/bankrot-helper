-- Добавляем поля для отслеживания статуса выплат
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS payout_1_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_2_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_3_completed boolean NOT NULL DEFAULT false;

-- Добавляем индексы для фильтрации
CREATE INDEX IF NOT EXISTS idx_agents_payout_1_completed ON public.agents(payout_1_completed);
CREATE INDEX IF NOT EXISTS idx_agents_payout_2_completed ON public.agents(payout_2_completed);
CREATE INDEX IF NOT EXISTS idx_agents_payout_3_completed ON public.agents(payout_3_completed);