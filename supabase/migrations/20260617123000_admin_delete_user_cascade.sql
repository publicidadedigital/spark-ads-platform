-- Cleans up rows that would block deleting an auth.users row (NO ACTION/RESTRICT
-- foreign keys pointing at auth.users, users_profile or advertiser_profiles),
-- so an admin can fully remove a user (and let them sign up again with the same e-mail).
-- Actual deletion of the auth.users row itself is done via the Supabase Admin API
-- (admin.auth.admin.deleteUser) right after calling this function, which cascades
-- to users_profile/advertiser_profiles and all CASCADE-configured tables.
create or replace function public.admin_predelete_user_cleanup(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_advertiser_id uuid;
  rec record;
  v_schema text;
  v_table text;
  v_nullable boolean;
  v_sql text;
begin
  select id into v_profile_id from public.users_profile where auth_user_id = p_auth_user_id;
  select id into v_advertiser_id from public.advertiser_profiles where auth_user_id = p_auth_user_id;

  for rec in
    select
      c.conrelid::regclass::text as tbl,
      a.attname as col,
      c.confrelid::regclass::text as reftbl
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.users_profile'::regclass, 'public.advertiser_profiles'::regclass)
      and c.confdeltype <> 'c'
      and array_length(c.conkey, 1) = 1
  loop
    if position('.' in rec.tbl) > 0 then
      v_schema := split_part(rec.tbl, '.', 1);
      v_table := split_part(rec.tbl, '.', 2);
    else
      v_schema := 'public';
      v_table := rec.tbl;
    end if;

    select (is_nullable = 'YES') into v_nullable
      from information_schema.columns
      where table_schema = v_schema and table_name = v_table and column_name = rec.col;

    if v_nullable then
      v_sql := format('update %I.%I set %I = null where %I = $1', v_schema, v_table, rec.col, rec.col);
    else
      v_sql := format('delete from %I.%I where %I = $1', v_schema, v_table, rec.col);
    end if;

    if rec.reftbl = 'auth.users' then
      execute v_sql using p_auth_user_id;
    elsif rec.reftbl = 'public.users_profile' and v_profile_id is not null then
      execute v_sql using v_profile_id;
    elsif rec.reftbl = 'public.advertiser_profiles' and v_advertiser_id is not null then
      execute v_sql using v_advertiser_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.admin_predelete_user_cleanup(uuid) to service_role;
