alter table public.system_settings
  add column if not exists ai_suggestions_enabled boolean not null default true;
