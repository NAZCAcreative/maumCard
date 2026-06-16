-- =============================================
-- 즐겨찾기 문구 테이블
-- =============================================

create table public.favorite_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  purpose    text,
  created_at timestamptz not null default now()
);

alter table public.favorite_messages enable row level security;

create policy "favorite_messages_owner_select" on public.favorite_messages
  for select using (auth.uid() = user_id);

create policy "favorite_messages_owner_insert" on public.favorite_messages
  for insert with check (auth.uid() = user_id);

create policy "favorite_messages_owner_delete" on public.favorite_messages
  for delete using (auth.uid() = user_id);

create index favorite_messages_user_idx on public.favorite_messages (user_id, created_at desc);
