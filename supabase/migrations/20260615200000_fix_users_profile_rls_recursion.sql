-- Fix infinite recursion (42P17) on users_profile RLS policies.
--
-- current_advertiser_profile_id(): ensure RLS is bypassed when resolving the
-- caller's advertiser profile id, regardless of the calling context.
create or replace function public.current_advertiser_profile_id()
returns uuid
language plpgsql
stable security definer
set search_path = public
set row_security = off
as $$
begin
  return (select id from public.advertiser_profiles where auth_user_id = auth.uid() limit 1);
end;
$$;

-- is_advertiser_participant(): SECURITY DEFINER helper that checks
-- campaign_shares/advertiser_campaigns without triggering their RLS
-- policies. This breaks the recursion cycle where
-- users_profile.up_select_advertiser_participants -> campaign_shares.cs_select
-- -> users_profile.
create or replace function public.is_advertiser_participant(p_user_profile_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_shares cs
    join public.advertiser_campaigns ac on ac.id = cs.advertiser_campaign_id
    where cs.user_id = p_user_profile_id
      and ac.advertiser_id = public.current_advertiser_profile_id()
  )
$$;

drop policy if exists up_select_advertiser_participants on public.users_profile;
create policy up_select_advertiser_participants on public.users_profile
  for select
  using (public.is_advertiser_participant(id));
