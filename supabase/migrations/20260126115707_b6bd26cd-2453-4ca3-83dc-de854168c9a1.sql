-- Добавляем авансовый платеж для клиента Ещенко
INSERT INTO payments (client_id, user_id, payment_number, original_amount, custom_amount, due_date, is_completed, payment_type)
SELECT 
  'ce9e8774-2bbc-4162-a953-48a02634845c',
  '3e33c35a-5473-4f01-8a3c-4a20e08d1fc7',
  0,
  10000,
  10000,
  contract_date,
  true,
  'advance'
FROM clients WHERE id = 'ce9e8774-2bbc-4162-a953-48a02634845c';

-- Обновляем total_paid и remaining_amount клиента
UPDATE clients 
SET total_paid = 25834,
    deposit_paid = 10000,
    remaining_amount = 200000 - 25834
WHERE id = 'ce9e8774-2bbc-4162-a953-48a02634845c';