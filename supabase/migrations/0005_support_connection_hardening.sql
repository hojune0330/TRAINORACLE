revoke insert on table public.support_connections from anon;
revoke insert on table public.support_connections from authenticated;
grant insert on table public.support_connections to service_role;

revoke update on table public.support_connections from anon;
revoke update on table public.support_connections from authenticated;
