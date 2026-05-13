-- ============================================================
-- PLATAFORMA DE PUBLICIDADE DIGITAL — SCHEMA COMPLETO
-- Rode este arquivo no Supabase SQL Editor (de uma vez)
-- ============================================================

-- ===== EXTENSIONS =====
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('pendente', 'ativo', 'bloqueado', 'aguardando_renovacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cycle_status as enum ('ativo', 'concluido', 'aguardando_renovacao', 'bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.share_status as enum ('pendente', 'aprovada', 'rejeitada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bonus_type as enum ('diario', 'indicacao', 'equipe', 'mensalidade');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bonus_status as enum ('pendente', 'liberado', 'bloqueado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tx_type as enum ('credito', 'debito', 'bloqueio', 'renovacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_type as enum ('imagem', 'video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('ativa', 'inativa');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. ROLES (NUNCA armazenar role na tabela de profile)
-- ============================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(_user_id, 'admin'); $$;

-- ============================================================
-- 3. PACOTES
-- ============================================================
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12,2) not null check (valor > 0),
  descricao text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  percentual_limite_ciclo numeric(6,2) not null default 200.00,
  created_at timestamptz not null default now()
);
alter table public.packages enable row level security;

-- Seed dos pacotes
insert into public.packages (nome, valor, descricao) values
  ('Inicial', 300.00, 'Pacote Inicial — entrada na plataforma'),
  ('Intermediário', 600.00, 'Pacote Intermediário'),
  ('Premium', 1200.00, 'Pacote Premium — máximo retorno')
on conflict do nothing;

-- ============================================================
-- 4. PERFIS
-- ============================================================
create table if not exists public.users_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null,
  cpf text unique,
  email text not null unique,
  telefone text unique,
  instagram text unique,
  instagram_validado boolean not null default false,
  seguidores_instagram integer default 0,
  status user_status not null default 'pendente',
  risk_score integer not null default 0,
  ip_cadastro text,
  device_fingerprint text,
  pacote_ativo_id uuid references public.packages(id),
  indicador_id uuid references public.users_profile(id),
  mensalidade_paga_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users_profile enable row level security;

create index if not exists idx_users_profile_auth on public.users_profile(auth_user_id);
create index if not exists idx_users_profile_indicador on public.users_profile(indicador_id);
create index if not exists idx_users_profile_status on public.users_profile(status);

-- ============================================================
-- 5. CICLOS DO USUÁRIO (200%)
-- ============================================================
create table if not exists public.user_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  package_id uuid not null references public.packages(id),
  valor_pacote numeric(12,2) not null,
  percentual_atual numeric(6,2) not null default 0,
  saldo_bonificacoes numeric(12,2) not null default 0,
  status cycle_status not null default 'ativo',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  renewed_at timestamptz
);
alter table public.user_cycles enable row level security;
create index if not exists idx_user_cycles_user on public.user_cycles(user_id, status);

-- ============================================================
-- 6. CAMPANHAS
-- ============================================================
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo_midia media_type not null,
  media_url text not null,
  texto_sugerido text not null,
  link_campanha text not null,
  rede_permitida text not null default 'instagram',
  instrucoes_obrigatorias text,
  status campaign_status not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create index if not exists idx_campaigns_status on public.campaigns(status);

-- ============================================================
-- 7. COMPARTILHAMENTOS
-- ============================================================
create table if not exists public.campaign_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id),
  cycle_id uuid references public.user_cycles(id),
  proof_url text,
  shared_link text not null,
  instagram_usado text,
  status share_status not null default 'pendente',
  motivo_rejeicao text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  shared_on_date date generated always as ((created_at at time zone 'UTC')::date) stored
);
alter table public.campaign_shares enable row level security;
create index if not exists idx_shares_user_date on public.campaign_shares(user_id, created_at);
create unique index if not exists uniq_share_per_day
  on public.campaign_shares(user_id, campaign_id, shared_on_date);
create unique index if not exists uniq_shared_link
  on public.campaign_shares(shared_link);

-- ============================================================
-- 8. BONIFICAÇÕES
-- ============================================================
create table if not exists public.bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  cycle_id uuid references public.user_cycles(id),
  tipo bonus_type not null,
  valor numeric(12,2) not null,
  origem_id uuid,
  nivel integer,
  status bonus_status not null default 'pendente',
  created_at timestamptz not null default now()
);
alter table public.bonuses enable row level security;
create index if not exists idx_bonuses_user on public.bonuses(user_id, created_at);

-- ============================================================
-- 9. INDICAÇÕES (multinível 5 + 10)
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.users_profile(id) on delete cascade,
  indicado_id uuid not null references public.users_profile(id) on delete cascade,
  nivel integer not null check (nivel between 1 and 10),
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  unique (indicador_id, indicado_id, nivel)
);
alter table public.referrals enable row level security;
create index if not exists idx_referrals_indicador on public.referrals(indicador_id, nivel);
create index if not exists idx_referrals_indicado on public.referrals(indicado_id);

-- ============================================================
-- 10. EXTRATO
-- ============================================================
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  cycle_id uuid references public.user_cycles(id),
  tipo tx_type not null,
  descricao text not null,
  valor numeric(12,2) not null,
  saldo_antes numeric(12,2) not null default 0,
  saldo_depois numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create index if not exists idx_wallet_user on public.wallet_transactions(user_id, created_at);

-- ============================================================
-- 11. ANTIFRAUDE
-- ============================================================
create table if not exists public.fraud_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users_profile(id) on delete cascade,
  tipo_evento text not null,
  descricao text,
  ip text,
  device_fingerprint text,
  risk_score_gerado integer default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.fraud_logs enable row level security;
create index if not exists idx_fraud_user on public.fraud_logs(user_id, created_at);

-- ============================================================
-- 12. AUDITORIA
-- ============================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  user_id uuid references public.users_profile(id),
  acao text not null,
  tabela_afetada text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

-- ============================================================
-- 13. TRIGGER — auto-criar profile no signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_indicador uuid;
  v_indicador_profile uuid;
begin
  -- buscar indicador via metadata (referral_code = profile.id)
  begin
    v_indicador := nullif(new.raw_user_meta_data->>'indicador_id','')::uuid;
  exception when others then v_indicador := null;
  end;

  if v_indicador is not null then
    select id into v_indicador_profile from public.users_profile where id = v_indicador;
  end if;

  insert into public.users_profile (
    auth_user_id, nome, email, cpf, telefone, instagram, indicador_id
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'cpf',''),
    nullif(new.raw_user_meta_data->>'telefone',''),
    nullif(new.raw_user_meta_data->>'instagram',''),
    v_indicador_profile
  );

  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;

  -- popular árvore de indicação até nível 10
  if v_indicador_profile is not null then
    perform public.build_referral_tree(
      (select id from public.users_profile where auth_user_id = new.id),
      v_indicador_profile
    );
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 14. ÁRVORE DE INDICAÇÃO (até 10 níveis)
-- ============================================================
create or replace function public.build_referral_tree(_novo_id uuid, _indicador_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_atual uuid := _indicador_id;
  v_nivel integer := 1;
begin
  while v_atual is not null and v_nivel <= 10 loop
    insert into public.referrals (indicador_id, indicado_id, nivel)
    values (v_atual, _novo_id, v_nivel)
    on conflict do nothing;

    select indicador_id into v_atual from public.users_profile where id = v_atual;
    v_nivel := v_nivel + 1;
  end loop;
end $$;

-- ============================================================
-- 15. RLS — POLICIES
-- ============================================================

-- user_roles: user vê os próprios; admin vê tudo
drop policy if exists ur_select_self on public.user_roles;
create policy ur_select_self on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists ur_admin_all on public.user_roles;
create policy ur_admin_all on public.user_roles
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- packages: leitura pública (autenticada); escrita só admin
drop policy if exists pk_select on public.packages;
create policy pk_select on public.packages
  for select to authenticated using (true);
drop policy if exists pk_admin on public.packages;
create policy pk_admin on public.packages
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- users_profile: usuário vê o próprio; admin vê tudo
drop policy if exists up_select_self on public.users_profile;
create policy up_select_self on public.users_profile
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists up_update_self on public.users_profile;
create policy up_update_self on public.users_profile
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
drop policy if exists up_admin_all on public.users_profile;
create policy up_admin_all on public.users_profile
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- user_cycles: dono ou admin
drop policy if exists uc_select on public.user_cycles;
create policy uc_select on public.user_cycles
  for select to authenticated
  using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );
drop policy if exists uc_admin on public.user_cycles;
create policy uc_admin on public.user_cycles
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- campaigns: ativas visíveis para todos autenticados; admin total
drop policy if exists cp_select on public.campaigns;
create policy cp_select on public.campaigns
  for select to authenticated
  using (status = 'ativa' or public.is_admin(auth.uid()));
drop policy if exists cp_admin on public.campaigns;
create policy cp_admin on public.campaigns
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- campaign_shares: dono insere/lê; admin tudo
drop policy if exists cs_select on public.campaign_shares;
create policy cs_select on public.campaign_shares
  for select to authenticated
  using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );
drop policy if exists cs_insert on public.campaign_shares;
create policy cs_insert on public.campaign_shares
  for insert to authenticated
  with check (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid()
                and status = 'ativo')
  );
drop policy if exists cs_admin on public.campaign_shares;
create policy cs_admin on public.campaign_shares
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- bonuses: dono lê; admin tudo
drop policy if exists bn_select on public.bonuses;
create policy bn_select on public.bonuses
  for select to authenticated
  using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );
drop policy if exists bn_admin on public.bonuses;
create policy bn_admin on public.bonuses
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- referrals: usuário vê sua árvore; admin tudo
drop policy if exists rf_select on public.referrals;
create policy rf_select on public.referrals
  for select to authenticated
  using (
    indicador_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or indicado_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- wallet_transactions: dono lê
drop policy if exists wt_select on public.wallet_transactions;
create policy wt_select on public.wallet_transactions
  for select to authenticated
  using (
    user_id in (select id from public.users_profile where auth_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- fraud_logs / audit_logs: só admin
drop policy if exists fl_admin on public.fraud_logs;
create policy fl_admin on public.fraud_logs
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists al_admin on public.audit_logs;
create policy al_admin on public.audit_logs
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ============================================================
-- 16. STORAGE (provas de compartilhamento + mídias de campanha)
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('campaign-media', 'campaign-media', true),
  ('share-proofs', 'share-proofs', false)
on conflict (id) do nothing;

-- campaign-media: leitura pública; upload só admin
drop policy if exists "campaign-media public read" on storage.objects;
create policy "campaign-media public read" on storage.objects
  for select using (bucket_id = 'campaign-media');
drop policy if exists "campaign-media admin write" on storage.objects;
create policy "campaign-media admin write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campaign-media' and public.is_admin(auth.uid()));
drop policy if exists "campaign-media admin update" on storage.objects;
create policy "campaign-media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'campaign-media' and public.is_admin(auth.uid()));
drop policy if exists "campaign-media admin delete" on storage.objects;
create policy "campaign-media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'campaign-media' and public.is_admin(auth.uid()));

-- share-proofs: usuário envia em pasta com seu auth.uid; lê o próprio; admin tudo
drop policy if exists "share-proofs user write" on storage.objects;
create policy "share-proofs user write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'share-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "share-proofs user read" on storage.objects;
create policy "share-proofs user read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'share-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- ============================================================
-- 17. PROMOVER PRIMEIRO ADMIN
-- Substitua o e-mail abaixo pelo seu e-mail de admin e execute:
-- ============================================================
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'SEU_EMAIL@exemplo.com'
-- on conflict do nothing;
