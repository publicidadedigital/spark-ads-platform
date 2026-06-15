-- Enable RLS and add policies for tables created by previously unapplied migrations
-- (system_error_logs, withdrawal_requests, withdrawal_batches, payment_orders,
-- point_events, goal_point_snapshots, advertiser_bonus_events).

alter table public.system_error_logs enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.withdrawal_batches enable row level security;
alter table public.payment_orders enable row level security;
alter table public.point_events enable row level security;
alter table public.goal_point_snapshots enable row level security;
alter table public.advertiser_bonus_events enable row level security;

-- system_error_logs: admin only
create policy system_error_logs_admin_select on public.system_error_logs
  for select using (is_admin(auth.uid()));

create policy system_error_logs_admin_update on public.system_error_logs
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- withdrawal_requests: owner or admin
create policy withdrawal_requests_select on public.withdrawal_requests
  for select using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or is_admin(auth.uid())
  );

-- withdrawal_batches: admin only
create policy withdrawal_batches_admin_select on public.withdrawal_batches
  for select using (is_admin(auth.uid()));

-- payment_orders: owner or admin
create policy payment_orders_select on public.payment_orders
  for select using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or is_admin(auth.uid())
  );

-- point_events: owner or admin
create policy point_events_select on public.point_events
  for select using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or is_admin(auth.uid())
  );

-- goal_point_snapshots: owner or admin
create policy goal_point_snapshots_select on public.goal_point_snapshots
  for select using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or is_admin(auth.uid())
  );

-- advertiser_bonus_events: referrer or admin
create policy advertiser_bonus_events_select on public.advertiser_bonus_events
  for select using (
    referrer_user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or is_admin(auth.uid())
  );
