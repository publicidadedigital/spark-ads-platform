-- PostgREST needs a foreign key to resolve the embedded
-- "users_profile:user_id(nome,email)" select used by the admin Saques page.
alter table public.withdrawal_requests
  add constraint withdrawal_requests_user_id_fkey
  foreign key (user_id) references public.users_profile (id) on delete cascade;

create index if not exists withdrawal_requests_user_id_idx on public.withdrawal_requests (user_id);
