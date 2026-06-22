-- 사용자가 직접 올린 사진을 카드 배경으로 사용/재사용하기 위한 테이블 + 스토리지.
-- 계정별 저장, 내 사진 분류용 카테고리 지원.

-- =============================================
-- user_backgrounds 테이블 (계정별)
-- =============================================
create table if not exists public.user_backgrounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  name text not null default '내 사진',
  category text not null default 'etc',
  storage_path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_backgrounds_user_id_idx
  on public.user_backgrounds (user_id, created_at desc);

alter table public.user_backgrounds enable row level security;

drop policy if exists "user_backgrounds_select_own" on public.user_backgrounds;
create policy "user_backgrounds_select_own" on public.user_backgrounds
  for select using (auth.uid() = user_id);

drop policy if exists "user_backgrounds_insert_own" on public.user_backgrounds;
create policy "user_backgrounds_insert_own" on public.user_backgrounds
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_backgrounds_delete_own" on public.user_backgrounds;
create policy "user_backgrounds_delete_own" on public.user_backgrounds
  for delete using (auth.uid() = user_id);

-- =============================================
-- Storage: user-backgrounds 버킷 (공개 읽기, 소유자 쓰기/삭제)
-- 업로드 경로 규칙: {user_id}/{파일명} → 폴더 첫 segment 로 소유권 판별
-- =============================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-backgrounds',
  'user-backgrounds',
  true,
  10485760, -- 10MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'user_backgrounds_public_read'
  ) then
    create policy "user_backgrounds_public_read"
      on storage.objects for select
      using (bucket_id = 'user-backgrounds');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'user_backgrounds_owner_write'
  ) then
    create policy "user_backgrounds_owner_write"
      on storage.objects for insert
      with check (
        bucket_id = 'user-backgrounds'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'user_backgrounds_owner_delete'
  ) then
    create policy "user_backgrounds_owner_delete"
      on storage.objects for delete
      using (
        bucket_id = 'user-backgrounds'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
