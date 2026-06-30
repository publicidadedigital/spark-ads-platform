-- Add missing FK constraints so PostgREST can resolve the joins used
-- in the admin/saques panel (referrer:referrer_user_id and advertiser:advertiser_id).
alter table public.advertiser_bonus_events
  add constraint advertiser_bonus_events_referrer_user_id_fkey
  foreign key (referrer_user_id) references public.users_profile(id) on delete set null;

alter table public.advertiser_bonus_events
  add constraint advertiser_bonus_events_advertiser_id_fkey
  foreign key (advertiser_id) references public.advertiser_profiles(id) on delete cascade;
