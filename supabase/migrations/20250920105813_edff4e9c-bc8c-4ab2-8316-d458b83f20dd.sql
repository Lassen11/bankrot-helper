-- Make germannlassen@gmail.com an administrator
INSERT INTO public.user_roles (user_id, role)
VALUES ('c47f5023-e037-468c-91d9-c7ae417d5289', 'admin')
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now();