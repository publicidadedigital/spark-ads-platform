-- Anti-fraud guards for campaign_shares submissions (Sec. 9):
--  - block invalid URLs (must be an instagram/x/twitter post link)
--  - block duplicate links already submitted by anyone
--  - block the same user submitting more than one active share per
--    campaign/cycle
--  - flag (don't block) submissions where the informed Instagram handle
--    diverges from the user's registered Instagram profile
create or replace function public.validate_campaign_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registered_instagram text;
  v_duplicate_link boolean;
  v_existing_share boolean;
begin
  if new.shared_link is null or new.shared_link !~* '^https?://(www\.)?(instagram\.com|x\.com|twitter\.com)/' then
    raise exception 'URL invalida: envie o link da publicacao no Instagram ou X/Twitter.';
  end if;

  select exists (
    select 1 from public.campaign_shares
    where lower(shared_link) = lower(new.shared_link)
      and status not in ('rejeitada', 'removida')
      and id is distinct from new.id
  ) into v_duplicate_link;
  if v_duplicate_link then
    raise exception 'Este link ja foi enviado por outro participante.';
  end if;

  select exists (
    select 1 from public.campaign_shares
    where user_id = new.user_id
      and status not in ('rejeitada', 'removida')
      and id is distinct from new.id
      and (
        (new.advertiser_campaign_id is not null and advertiser_campaign_id = new.advertiser_campaign_id and cycle_id = new.cycle_id)
        or (new.campaign_id is not null and campaign_id = new.campaign_id and cycle_id = new.cycle_id)
      )
  ) into v_existing_share;
  if v_existing_share then
    raise exception 'Voce ja enviou um compartilhamento para esta campanha neste ciclo.';
  end if;

  if new.instagram_usado is not null and new.instagram_usado <> '' then
    select instagram into v_registered_instagram from public.users_profile where id = new.user_id;
    if v_registered_instagram is not null and lower(trim(v_registered_instagram, '@')) <> lower(trim(new.instagram_usado, '@')) then
      new.validation_status := 'suspeito';
      new.validation_reason := 'Instagram informado (' || new.instagram_usado || ') diverge do cadastrado (' || v_registered_instagram || ').';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_shares_antifraud on public.campaign_shares;
create trigger campaign_shares_antifraud
  before insert on public.campaign_shares
  for each row
  execute function public.validate_campaign_share();
