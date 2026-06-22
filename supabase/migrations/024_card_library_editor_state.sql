alter table public.card_library
  add column if not exists editor_state jsonb not null default '{}'::jsonb;
