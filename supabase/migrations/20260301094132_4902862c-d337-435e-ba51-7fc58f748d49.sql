
-- Таблица сообщений чата кабинета клиента
CREATE TABLE public.cabinet_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'client', -- 'client' or 'employee'
  sender_id uuid, -- null for client, user_id for employee
  message text NOT NULL DEFAULT '',
  file_url text,
  file_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cabinet_messages ENABLE ROW LEVEL SECURITY;

-- Employees can manage messages for their clients
CREATE POLICY "Employees can manage their client messages"
ON public.cabinet_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = cabinet_messages.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = cabinet_messages.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
);

-- Storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) VALUES ('cabinet-files', 'cabinet-files', true);

-- Storage policies for cabinet-files
CREATE POLICY "Authenticated users can upload cabinet files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cabinet-files');

CREATE POLICY "Anyone can view cabinet files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'cabinet-files');

CREATE POLICY "Authenticated users can delete cabinet files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cabinet-files');
