create table if not exists public.card_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  purpose text not null,
  recipient text not null,
  honorific text not null default '에게',
  message text not null,
  background_id text not null,
  is_ai_bg boolean not null default false,
  card_image_url text,
  share_token text unique,
  is_favorite boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_library enable row level security;

drop policy if exists "card_library_select_own" on public.card_library;
create policy "card_library_select_own" on public.card_library
  for select using (auth.uid() = user_id);

drop policy if exists "card_library_select_share" on public.card_library;
create policy "card_library_select_share" on public.card_library
  for select using (share_token is not null and is_hidden = false);

drop policy if exists "card_library_insert" on public.card_library;
create policy "card_library_insert" on public.card_library
  for insert with check (auth.uid() = user_id);

drop policy if exists "card_library_update" on public.card_library;
create policy "card_library_update" on public.card_library
  for update using (auth.uid() = user_id);

drop policy if exists "card_library_delete" on public.card_library;
create policy "card_library_delete" on public.card_library
  for delete using (auth.uid() = user_id);

drop trigger if exists card_library_updated_at on public.card_library;
create trigger card_library_updated_at
  before update on public.card_library
  for each row execute procedure public.set_updated_at();
