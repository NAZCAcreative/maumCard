create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  card_name text,
  card_message text,
  prompt text not null,
  model text not null,
  bg text,
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.generation_logs enable row level security;

-- 관리자만 전체 조회 가능 (service role via API)
-- 공개 접근 없음
