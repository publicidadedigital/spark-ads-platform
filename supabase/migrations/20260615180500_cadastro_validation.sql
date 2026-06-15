-- Garante 1 CNPJ por cadastro de anunciante (espelha a unicidade já existente de CPF em users_profile)
alter table public.advertiser_profiles
  add constraint advertiser_profiles_cnpj_key unique (cnpj);

-- Função pública para checar duplicidade de e-mail/cpf/cnpj antes do cadastro,
-- permitindo mensagens de erro especificas no formulario (ex: "CPF ja cadastrado").
create or replace function public.check_cadastro_availability(p_email text, p_cpf text default null, p_cnpj text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_taken boolean := false;
  v_cpf_taken boolean := false;
  v_cnpj_taken boolean := false;
begin
  if p_email is not null and p_email <> '' then
    select exists(select 1 from auth.users where lower(email) = lower(p_email)) into v_email_taken;
  end if;

  if p_cpf is not null and p_cpf <> '' then
    select exists(select 1 from public.users_profile where cpf = p_cpf) into v_cpf_taken;
  end if;

  if p_cnpj is not null and p_cnpj <> '' then
    select exists(select 1 from public.advertiser_profiles where cnpj = p_cnpj) into v_cnpj_taken;
  end if;

  return jsonb_build_object(
    'email_taken', v_email_taken,
    'cpf_taken', v_cpf_taken,
    'cnpj_taken', v_cnpj_taken
  );
end;
$$;

grant execute on function public.check_cadastro_availability(text, text, text) to anon, authenticated;
