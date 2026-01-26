-- Исправляем данные клиента Ещенко - обнуляем deposit_paid
UPDATE clients 
SET deposit_paid = 0, 
    total_paid = 15834, 
    remaining_amount = 200000 - 15834
WHERE id = 'ce9e8774-2bbc-4162-a953-48a02634845c';

-- Создаем функцию для автоматического расчета deposit_paid на основе авансовых платежей
CREATE OR REPLACE FUNCTION public.calculate_deposit_from_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  advance_sum numeric;
BEGIN
  -- Если это авансовый платеж и он помечен как выполненный
  IF NEW.payment_type = 'advance' AND NEW.is_completed = true AND (OLD.is_completed = false OR OLD IS NULL) THEN
    -- Получаем сумму всех выполненных авансовых платежей для этого клиента
    SELECT COALESCE(SUM(COALESCE(custom_amount, original_amount)), 0)
    INTO advance_sum
    FROM payments
    WHERE client_id = NEW.client_id 
      AND payment_type = 'advance' 
      AND is_completed = true
      AND id != NEW.id;
    
    -- Добавляем текущий платеж
    advance_sum := advance_sum + COALESCE(NEW.custom_amount, NEW.original_amount);
    
    -- Обновляем deposit_paid клиента
    UPDATE clients 
    SET deposit_paid = advance_sum
    WHERE id = NEW.client_id;
  END IF;
  
  -- Если авансовый платеж отменяется (был выполнен, стал невыполненным)
  IF NEW.payment_type = 'advance' AND NEW.is_completed = false AND OLD.is_completed = true THEN
    -- Получаем сумму всех выполненных авансовых платежей для этого клиента (без текущего)
    SELECT COALESCE(SUM(COALESCE(custom_amount, original_amount)), 0)
    INTO advance_sum
    FROM payments
    WHERE client_id = NEW.client_id 
      AND payment_type = 'advance' 
      AND is_completed = true
      AND id != NEW.id;
    
    -- Обновляем deposit_paid клиента
    UPDATE clients 
    SET deposit_paid = advance_sum
    WHERE id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Удаляем старый триггер если существует
DROP TRIGGER IF EXISTS trigger_calculate_deposit_from_advance ON payments;

-- Создаем триггер для автоматического расчета deposit_paid
CREATE TRIGGER trigger_calculate_deposit_from_advance
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION calculate_deposit_from_advance();

-- Пересчитываем deposit_paid для всех клиентов на основе их авансовых платежей
UPDATE clients c
SET deposit_paid = COALESCE((
  SELECT SUM(COALESCE(p.custom_amount, p.original_amount))
  FROM payments p
  WHERE p.client_id = c.id 
    AND p.payment_type = 'advance' 
    AND p.is_completed = true
), 0);