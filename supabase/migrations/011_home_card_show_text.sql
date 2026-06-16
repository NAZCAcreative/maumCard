alter table public.home_featured_cards
  add column if not exists show_text boolean not null default true;

alter table public.home_featured_cards
  add column if not exists show_title boolean not null default true;
