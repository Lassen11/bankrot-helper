
-- Таблица токенов для доступа к кабинету клиента
CREATE TABLE public.client_cabinet_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_cabinet_tokens_token_key UNIQUE (token)
);

-- Таблица этапов банкротства
CREATE TABLE public.bankruptcy_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage_number integer NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bankruptcy_stages_client_stage_unique UNIQUE (client_id, stage_number)
);

-- RLS для client_cabinet_tokens
ALTER TABLE public.client_cabinet_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can manage their client tokens"
ON public.client_cabinet_tokens
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_cabinet_tokens.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_cabinet_tokens.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
);

-- RLS для bankruptcy_stages
ALTER TABLE public.bankruptcy_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can manage their client stages"
ON public.bankruptcy_stages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = bankruptcy_stages.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = bankruptcy_stages.client_id 
    AND (clients.employee_id = auth.uid() OR public.is_admin())
  )
);

-- Триггер обновления updated_at для bankruptcy_stages
CREATE TRIGGER update_bankruptcy_stages_updated_at
  BEFORE UPDATE ON public.bankruptcy_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
