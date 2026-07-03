-- Adds structured cancellation reason and payment-proof attachment to bonuses.
-- motivo_cancelamento: machine-readable category used by the associate UI to
--   branch on (show proof-upload when 'pagamento_nao_confirmado').
-- comprovante_url: storage path uploaded by the associate after cancellation
--   with 'pagamento_nao_confirmado' so admin can review it.

alter table public.bonuses
  add column if not exists motivo_cancelamento text,
  add column if not exists comprovante_url      text;

alter table public.bonuses
  drop constraint if exists bonuses_motivo_cancelamento_check;

alter table public.bonuses
  add constraint bonuses_motivo_cancelamento_check
  check (
    motivo_cancelamento is null
    or motivo_cancelamento in (
      'pagamento_nao_confirmado',
      'ativacao_manual_sem_pagamento',
      'outro'
    )
  );

-- Storage bucket for payment-proof files attached by associates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bonus-proofs',
  'bonus-proofs',
  false,
  5242880,   -- 5 MB
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- RLS: associates can upload a proof only for their own cancelled bonus.
-- Admins (service role) bypass RLS.
create policy "associates upload own bonus proofs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bonus-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "associates read own bonus proofs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bonus-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
