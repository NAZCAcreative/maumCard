alter table public.system_settings
  add column if not exists hand_font_round_enabled boolean not null default true;

alter table public.system_settings
  add column if not exists hand_font_brush_enabled boolean not null default true;

alter table public.system_settings
  add column if not exists hand_font_pen_enabled boolean not null default true;

alter table public.system_settings
  add column if not exists hand_paper_enabled boolean not null default true;

alter table public.system_settings
  add column if not exists hand_paper_style text not null default 'hanji';

insert into public.system_settings (
  id,
  signup_bonus_credits,
  ai_suggestions_enabled,
  announcement_enabled,
  announcement_title,
  announcement_message,
  hand_font_round_enabled,
  hand_font_brush_enabled,
  hand_font_pen_enabled,
  hand_paper_enabled,
  hand_paper_style
)
values ('default', 3, true, false, '', '', true, true, true, true, 'hanji')
on conflict (id) do update set
  hand_font_round_enabled = coalesce(excluded.hand_font_round_enabled, public.system_settings.hand_font_round_enabled),
  hand_font_brush_enabled = coalesce(excluded.hand_font_brush_enabled, public.system_settings.hand_font_brush_enabled),
  hand_font_pen_enabled = coalesce(excluded.hand_font_pen_enabled, public.system_settings.hand_font_pen_enabled),
  hand_paper_enabled = coalesce(excluded.hand_paper_enabled, public.system_settings.hand_paper_enabled),
  hand_paper_style = coalesce(excluded.hand_paper_style, public.system_settings.hand_paper_style),
  updated_at = now();
