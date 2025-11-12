-- Add termination fields to clients table
ALTER TABLE public.clients 
ADD COLUMN is_terminated BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN terminated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN termination_reason TEXT;

-- Add index for faster queries on terminated clients
CREATE INDEX idx_clients_is_terminated ON public.clients(is_terminated);

-- Add comment for documentation
COMMENT ON COLUMN public.clients.is_terminated IS 'Indicates if the contract has been terminated';
COMMENT ON COLUMN public.clients.terminated_at IS 'Timestamp when the contract was terminated';
COMMENT ON COLUMN public.clients.termination_reason IS 'Reason for contract termination';