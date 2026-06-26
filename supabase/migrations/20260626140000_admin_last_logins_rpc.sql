-- Lets the admin panel read last_sign_in_at for every auth user directly
-- through PostgREST (instead of a service-role server function that was
-- silently failing in production), guarded by the same admin-role check
-- used elsewhere.
create or replace function public.admin_list_last_logins()
returns table (auth_user_id uuid, last_sign_in_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
    or exists (select 1 from public.admin_roles where auth_user_id = auth.uid() and status = 'ativo')
  ) then
    raise exception 'Acesso administrativo necessario';
  end if;

  return query
    select au.id, au.last_sign_in_at
    from auth.users au;
end;
$$;

grant execute on function public.admin_list_last_logins() to authenticated;
