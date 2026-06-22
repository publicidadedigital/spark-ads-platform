create or replace function public.get_referrer_name(p_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select nome from public.users_profile where id = p_id limit 1;
$$;

grant execute on function public.get_referrer_name(uuid) to anon, authenticated;
