alter table public.card_library
  add column if not exists compose_mode text not null default 'short';

