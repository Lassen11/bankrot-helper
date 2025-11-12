-- Add suspension columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_clients_is_suspended ON public.clients(is_suspended);

-- Update comments
COMMENT ON COLUMN public.clients.is_suspended IS 'Indicates if the contract is suspended';
COMMENT ON COLUMN public.clients.suspended_at IS 'Timestamp when the contract was suspended';
COMMENT ON COLUMN public.clients.suspension_reason IS 'Reason for contract suspension';