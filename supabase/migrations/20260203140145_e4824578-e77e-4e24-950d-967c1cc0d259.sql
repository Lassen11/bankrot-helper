-- Удаляем триггер который вызывает дублирование отправки платежей в pnltracker
DROP TRIGGER IF EXISTS trigger_notify_pnltracker_payment_sync ON payments;

-- Удаляем функцию после удаления триггера
DROP FUNCTION IF EXISTS notify_pnltracker_payment_sync();