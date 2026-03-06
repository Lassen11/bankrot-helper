
-- Table for files attached to bankruptcy stages
CREATE TABLE public.bankruptcy_stage_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.bankruptcy_stages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bankruptcy_stage_files ENABLE ROW LEVEL SECURITY;

-- Employees can manage files for their clients, admins can manage all
CREATE POLICY "Employees can manage stage files"
ON public.bankruptcy_stage_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = bankruptcy_stage_files.client_id
    AND (clients.employee_id = auth.uid() OR is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = bankruptcy_stage_files.client_id
    AND (clients.employee_id = auth.uid() OR is_admin())
  )
);
