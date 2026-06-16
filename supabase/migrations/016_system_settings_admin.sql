alter table public.system_settings
  add column if not exists ai_suggestions_enabled boolean not null default true;

alter table public.system_settings
  add column if not exists announcement_enabled boolean not null default false;

alter table public.system_settings
  add column if not exists announcement_title text not null default '';

alter table public.system_settings
  add column if not exists announcement_message text not null default '';

insert into public.system_settings (
  id,
  signup_bonus_credits,
  ai_suggestions_enabled,
  announcement_enabled,
  announcement_title,
  announcement_message
)
values ('default', 3, true, false, '', '')
on conflict (id) do update set
  signup_bonus_credits = coalesce(excluded.signup_bonus_credits, public.system_settings.signup_bonus_credits),
  ai_suggestions_enabled = coalesce(excluded.ai_suggestions_enabled, public.system_settings.ai_suggestions_enabled),
  announcement_enabled = coalesce(excluded.announcement_enabled, public.system_settings.announcement_enabled),
  announcement_title = coalesce(excluded.announcement_title, public.system_settings.announcement_title),
  announcement_message = coalesce(excluded.announcement_message, public.system_settings.announcement_message),
  updated_at = now();

update public.system_settings
set
  ai_suggestions_enabled = coalesce(ai_suggestions_enabled, true),
  announcement_enabled = coalesce(announcement_enabled, false),
  announcement_title = coalesce(announcement_title, ''),
  announcement_message = coalesce(announcement_message, ''),
  updated_at = now()
where id = 'default';
