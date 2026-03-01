
-- Create client_employees junction table
CREATE TABLE public.client_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  role_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint
CREATE UNIQUE INDEX client_employees_client_employee_unique ON public.client_employees (client_id, employee_id);

-- Enable RLS
ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;

-- RLS: owner employee or admin can do everything
CREATE POLICY "Employees can manage team for their clients"
ON public.client_employees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_employees.client_id
      AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_employees.client_id
      AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
);
