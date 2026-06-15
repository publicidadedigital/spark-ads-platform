-- Admin-editable settings for the renewal ("renovação") flow shown in /app/renovacao.

create table if not exists public.renewal_settings (
  id uuid primary key default gen_random_uuid(),
  cycle_duration_days integer not null default 90,
  cycle_goal_percent numeric not null default 200,
  updated_at timestamptz not null default now()
);

insert into public.renewal_settings (cycle_duration_days, cycle_goal_percent)
select 90, 200
where not exists (select 1 from public.renewal_settings);

alter table public.renewal_settings enable row level security;

create policy rs_select on public.renewal_settings
  for select to authenticated using (true);

create policy rs_admin on public.renewal_settings
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Renewal/referral bonus levels paid when a user renews their package.
create table if not exists public.renewal_bonus_levels (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique,
  rate numeric not null,
  created_at timestamptz not null default now()
);

insert into public.renewal_bonus_levels (level, rate) values
  (1, 0.20),
  (2, 0.10),
  (3, 0.03),
  (4, 0.03),
  (5, 0.03)
on conflict (level) do nothing;

alter table public.renewal_bonus_levels enable row level security;

create policy rbl_select on public.renewal_bonus_levels
  for select to authenticated using (true);

create policy rbl_admin on public.renewal_bonus_levels
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
