-- Enable Row Level Security on clients table
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a client management system where admin can see all clients)
-- For now, allow public access since there's no authentication system yet
CREATE POLICY "Allow public read access to clients" 
ON public.clients 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to clients" 
ON public.clients 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to clients" 
ON public.clients 
FOR DELETE 
USING (true);