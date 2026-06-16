-- =============================================
-- 배경 이미지 라이브러리 테이블
-- =============================================

create table public.backgrounds (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'nature',
  storage_path text not null,
  url          text not null,
  prompt       text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 누구나 읽기 가능 (배경 갤러리는 공개)
alter table public.backgrounds enable row level security;
create policy "backgrounds_public_read" on public.backgrounds
  for select using (true);

-- NOTE: Supabase Dashboard에서 아래 작업 필요:
-- 1. Storage > Buckets > 'backgrounds' 버킷 생성 (Public)
-- 2. Storage Policy: Public read on backgrounds bucket
