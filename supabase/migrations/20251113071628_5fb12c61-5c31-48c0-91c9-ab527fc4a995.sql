-- Функция для пересчёта remaining_amount для всех клиентов
CREATE OR REPLACE FUNCTION recalculate_remaining_amounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE clients 
    SET remaining_amount = GREATEST(0, contract_amount - total_paid);
END;
$$;

-- Вызываем функцию для пересчёта
SELECT recalculate_remaining_amounts();