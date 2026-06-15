-- Email confirmation flow prepared for Resend.
-- Configure RESEND_API_KEY and RESEND_FROM_EMAIL in the runtime environment to enable real delivery.

create extension if not exists pgcrypto;

alter table if exists public.users_profile
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists email_confirmation_sent_at timestamptz,
  add column if not exists email_confirmation_required boolean not null default true;

create table if not exists public.email_confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  resend_message_id text,
  delivery_status text not null default 'created' check (delivery_status in ('created', 'sent', 'not_configured', 'failed', 'consumed', 'expired')),
  request_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists email_confirmation_tokens_user_id_idx
  on public.email_confirmation_tokens(user_id, created_at desc);

create index if not exists email_confirmation_tokens_active_idx
  on public.email_confirmation_tokens(user_id, expires_at desc)
  where consumed_at is null;

create table if not exists public.system_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  value numeric,
  points numeric,
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  observation text,
  request_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists system_audit_events_user_idx
  on public.system_audit_events(user_id, created_at desc);

create index if not exists system_audit_events_type_idx
  on public.system_audit_events(event_type, created_at desc);

alter table public.email_confirmation_tokens enable row level security;
alter table public.system_audit_events enable row level security;

-- Service role handles these records through server routes.
-- No public select/insert policies are intentionally created here.
