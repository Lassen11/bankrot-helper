-- Добавляем поле account в таблицу payments для хранения информации о счете
ALTER TABLE public.payments 
ADD COLUMN account TEXT;

-- Добавляем комментарий для документации
COMMENT ON COLUMN public.payments.account IS 'Счет куда поступили деньги: Зайнаб карта, Касса офис Диана, Мариана Карта - депозит, Карта Visa/Т-Банк (КИ), Наличные, Сейф (КИ), Расчетный счет';