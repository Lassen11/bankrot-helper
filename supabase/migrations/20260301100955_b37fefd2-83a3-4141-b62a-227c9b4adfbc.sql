
-- Restructure client_employees: remove employee_id, add direct fields
ALTER TABLE public.client_employees 
  DROP COLUMN IF EXISTS employee_id,
  ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text;

-- Drop the old unique index
DROP INDEX IF EXISTS client_employees_client_employee_unique;
