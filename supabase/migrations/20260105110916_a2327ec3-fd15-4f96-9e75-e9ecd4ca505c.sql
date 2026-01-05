-- Добавляем поле completed_at для хранения точной даты завершения клиента
ALTER TABLE public.clients 
ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN public.clients.completed_at IS 'Дата завершения договора клиента (выставляется вручную)';