-- Two-factor authentication (TOTP / Google Authenticator) for any account
-- (admin, client or advertiser), used to confirm withdrawal requests.
create table if not exists public.two_factor_auth (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  secret text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.two_factor_auth enable row level security;

create policy tfa_self on public.two_factor_auth
  for all to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Document (CPF/CNPJ) informed on a withdrawal request, so it can be
-- validated against the document registered on the account.
alter table public.withdrawal_requests
  add column if not exists destination_document text;
