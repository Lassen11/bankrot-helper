-- Создание таблицы клиентов для банкротства
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  contract_amount DECIMAL(12,2) NOT NULL CHECK (contract_amount > 0),
  installment_period INTEGER NOT NULL CHECK (installment_period > 0),
  first_payment DECIMAL(12,2) NOT NULL CHECK (first_payment >= 0),
  monthly_payment DECIMAL(12,2) NOT NULL CHECK (monthly_payment >= 0),
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индекса для поиска по имени
CREATE INDEX idx_clients_full_name ON public.clients USING gin(to_tsvector('russian', full_name));

-- Функция для обновления timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Добавление комментариев для документации
COMMENT ON TABLE public.clients IS 'Таблица клиентов банкротства физических лиц';
COMMENT ON COLUMN public.clients.full_name IS 'Полное имя клиента (ФИО)';
COMMENT ON COLUMN public.clients.contract_amount IS 'Сумма договора в рублях';
COMMENT ON COLUMN public.clients.installment_period IS 'Срок рассрочки в месяцах';
COMMENT ON COLUMN public.clients.first_payment IS 'Размер первого платежа в рублях';
COMMENT ON COLUMN public.clients.monthly_payment IS 'Размер ежемесячного платежа в рублях';
COMMENT ON COLUMN public.clients.remaining_amount IS 'Остаток к оплате в рублях';