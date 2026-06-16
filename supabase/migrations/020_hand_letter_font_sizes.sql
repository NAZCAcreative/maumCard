alter table public.system_settings
  add column if not exists hand_compose_font_size integer not null default 18,
  add column if not exists hand_viewer_font_size integer not null default 18;

update public.system_settings
set
  hand_compose_font_size = coalesce(hand_compose_font_size, 18),
  hand_viewer_font_size = coalesce(hand_viewer_font_size, 18),
  updated_at = now()
where id = 'default';
