create table if not exists public.home_featured_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text not null,
  link_href text not null default '/create',
  cta_label text not null default '카드 만들기',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.home_featured_cards enable row level security;

drop policy if exists "home_featured_cards_public_read" on public.home_featured_cards;
create policy "home_featured_cards_public_read"
  on public.home_featured_cards
  for select using (is_active = true);

drop trigger if exists home_featured_cards_updated_at on public.home_featured_cards;
create trigger home_featured_cards_updated_at
  before update on public.home_featured_cards
  for each row execute procedure public.set_updated_at();
