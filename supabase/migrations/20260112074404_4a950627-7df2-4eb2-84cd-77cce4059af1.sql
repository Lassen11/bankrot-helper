-- Исправляем user_id платежей: устанавливаем employee_id клиента
-- Это нужно для корректной работы RLS - чтобы сотрудник видел все платежи своего клиента

UPDATE payments p
SET user_id = c.employee_id
FROM clients c
WHERE p.client_id = c.id
  AND p.user_id != c.employee_id
  AND c.employee_id IS NOT NULL;