-- Business-rule audit and accounting support.
-- This migration is intentionally idempotent because the live Supabase project
-- was unavailable during the code audit.

create extension if not exists pgcrypto;

create table if not exists public.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  module text not null,
  error_type text not null,
  description text not null,
  probable_reason text null,
  recommended_action text null,
  status text not null default 'novo' check (status in ('novo', 'em_analise', 'resolvido', 'ignorado')),
  severity text not null default 'medio' check (severity in ('baixo', 'medio', 'alto', 'critico')),
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz null,
  resolved_by uuid null
);

create index if not exists system_error_logs_created_at_idx on public.system_error_logs (created_at desc);
create index if not exists system_error_logs_status_idx on public.system_error_logs (status);
create index if not exists system_error_logs_severity_idx on public.system_error_logs (severity);
create index if not exists system_error_logs_module_idx on public.system_error_logs (module);
create index if not exists system_error_logs_user_id_idx on public.system_error_logs (user_id);

alter table public.packages add column if not exists package_value numeric(12,2);
alter table public.packages add column if not exists course_fee numeric(12,2) not null default 10;
alter table public.packages add column if not exists total_paid numeric(12,2);
alter table public.packages add column if not exists bonusable_amount numeric(12,2);
alter table public.packages add column if not exists cycle_limit_200 numeric(12,2);
alter table public.packages add column if not exists amount_counted_for_rewards numeric(12,2);
alter table public.packages add column if not exists daily_bonus numeric(12,2);

update public.packages
set
  course_fee = 10,
  package_value = coalesce(
    package_value,
    case
      when valor in (60, 130, 310, 1010) then valor - 10
      else valor
    end
  )
where package_value is null or course_fee is null;

update public.packages
set
  bonusable_amount = coalesce(bonusable_amount, package_value),
  amount_counted_for_rewards = coalesce(amount_counted_for_rewards, package_value),
  total_paid = coalesce(total_paid, package_value + course_fee),
  cycle_limit_200 = coalesce(cycle_limit_200, package_value * 2),
  daily_bonus = coalesce(daily_bonus, round(package_value * 0.0026, 2))
where package_value is not null;

alter table public.user_cycles add column if not exists package_value numeric(12,2);
alter table public.user_cycles add column if not exists course_fee numeric(12,2) not null default 10;
alter table public.user_cycles add column if not exists total_paid numeric(12,2);
alter table public.user_cycles add column if not exists bonusable_amount numeric(12,2);
alter table public.user_cycles add column if not exists cycle_limit_200 numeric(12,2);
alter table public.user_cycles add column if not exists amount_counted_for_rewards numeric(12,2);
alter table public.user_cycles add column if not exists renewal_grace_until timestamptz null;
alter table public.user_cycles add column if not exists points_lost_at timestamptz null;
alter table public.user_cycles add column if not exists status_normalized text null;

update public.user_cycles
set
  package_value = coalesce(
    package_value,
    case
      when valor_pacote in (60, 130, 310, 1010) then valor_pacote - 10
      else valor_pacote
    end
  )
where package_value is null;

update public.user_cycles
set
  bonusable_amount = coalesce(bonusable_amount, package_value),
  amount_counted_for_rewards = coalesce(amount_counted_for_rewards, package_value),
  total_paid = coalesce(total_paid, package_value + course_fee),
  cycle_limit_200 = coalesce(cycle_limit_200, package_value * 2),
  status_normalized = coalesce(status_normalized, status)
where package_value is not null;

alter table public.wallet_transactions add column if not exists bonusable_amount numeric(12,2);
alter table public.wallet_transactions add column if not exists course_fee numeric(12,2);
alter table public.wallet_transactions add column if not exists source_type text;
alter table public.wallet_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.point_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  source_user_id uuid null,
  source_event text not null,
  financial_amount numeric(12,2) not null default 0,
  amount_counted_for_points numeric(12,2) not null default 0,
  points numeric(14,2) not null default 0,
  status text not null default 'valid',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists point_events_user_id_idx on public.point_events (user_id);
create index if not exists point_events_created_at_idx on public.point_events (created_at desc);
create index if not exists point_events_source_event_idx on public.point_events (source_event);

create table if not exists public.goal_point_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  goal_key text not null,
  target_points numeric(14,2) not null,
  gross_points numeric(14,2) not null default 0,
  valid_points numeric(14,2) not null default 0,
  ignored_points numeric(14,2) not null default 0,
  legs jsonb not null default '[]'::jsonb
);

create index if not exists goal_point_snapshots_user_goal_idx on public.goal_point_snapshots (user_id, goal_key, created_at desc);

create table if not exists public.advertiser_bonus_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  advertiser_id uuid null,
  referrer_user_id uuid not null,
  advertising_package_id uuid null,
  gross_amount numeric(12,2) not null default 0,
  operational_cost numeric(12,2) not null default 0,
  real_profit numeric(12,2) not null default 0,
  referrer_bonus numeric(12,2) not null default 0,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists advertiser_bonus_events_referrer_idx on public.advertiser_bonus_events (referrer_user_id, created_at desc);
