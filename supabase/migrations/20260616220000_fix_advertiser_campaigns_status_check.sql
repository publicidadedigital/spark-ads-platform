-- The advertiser_campaigns.status check constraint only allowed
-- aguardando_envio/em_analise/ajustes_solicitados/aprovada/em_distribuicao/concluida/reprovada,
-- but the admin UI (campanhas-anunciantes.tsx) writes ativa/pausada/finalizada,
-- causing "violates check constraint" errors on approve/pause/finish actions.
ALTER TABLE advertiser_campaigns DROP CONSTRAINT advertiser_campaigns_status_check;
ALTER TABLE advertiser_campaigns ADD CONSTRAINT advertiser_campaigns_status_check
  CHECK (status = ANY (ARRAY[
    'aguardando_envio'::text,
    'em_analise'::text,
    'ajustes_solicitados'::text,
    'aprovada'::text,
    'em_distribuicao'::text,
    'concluida'::text,
    'reprovada'::text,
    'ativa'::text,
    'pausada'::text,
    'finalizada'::text
  ]));
