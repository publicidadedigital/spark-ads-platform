create extension if not exists pgcrypto;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  cycle_id uuid null,
  provider text not null default 'efi',
  method text not null check (method in ('pix', 'crypto', 'internal_balance')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'failed', 'expired', 'cancelled')),
  external_id text unique,
  amount_usd numeric(12,2) not null,
  package_value_usd numeric(12,2) not null default 0,
  course_fee_usd numeric(12,2) not null default 0,
  bonusable_amount_usd numeric(12,2) not null default 0,
  amount_brl numeric(14,2),
  exchange_rate numeric(14,6),
  exchange_source text,
  pix_copy_paste text,
  pix_qr_base64 text,
  paid_at timestamptz null,
  raw_response jsonb not null default '{}'::jsonb
);

create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders (status);
create index if not exists payment_orders_external_idx on public.payment_orders (external_id);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  amount_usd numeric(12,2) not null,
  method text not null check (method in ('pix', 'crypto')),
  destination_key text not null,
  destination_holder text null,
  status text not null default 'solicitado' check (status in ('solicitado', 'em_analise', 'aprovado', 'em_processamento', 'pago', 'recusado', 'cancelado')),
  requested_processing_day smallint null check (requested_processing_day in (15, 30)),
  admin_notes text null,
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  paid_by uuid null,
  paid_at timestamptz null,
  batch_id uuid null,
  provider text null,
  provider_reference text null,
  raw_response jsonb not null default '{}'::jsonb
);

create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (status, created_at desc);
create index if not exists withdrawal_requests_user_idx on public.withdrawal_requests (user_id, created_at desc);
create index if not exists withdrawal_requests_batch_idx on public.withdrawal_requests (batch_id);

create table if not exists public.withdrawal_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  status text not null default 'created' check (status in ('created', 'processing', 'completed', 'failed', 'partial')),
  total_amount_usd numeric(14,2) not null default 0,
  total_requests integer not null default 0,
  notes text null,
  raw_response jsonb not null default '{}'::jsonb
);

create index if not exists withdrawal_batches_status_idx on public.withdrawal_batches (status, created_at desc);

alter table public.wallet_transactions add column if not exists withdrawal_request_id uuid null;
alter table public.wallet_transactions add column if not exists payment_order_id uuid null;

-- Package correction: Start is US$60 package + US$10 course = US$70 total.
update public.packages
set
  package_value = 60,
  course_fee = 10,
  total_paid = 70,
  bonusable_amount = 60,
  amount_counted_for_rewards = 60,
  cycle_limit_200 = 120,
  daily_bonus = round(60 * 0.0026, 2),
  valor = 70
where lower(nome) like '%start%' or valor in (50, 60);
