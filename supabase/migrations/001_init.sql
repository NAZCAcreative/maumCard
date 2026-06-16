-- =============================================
-- 마음카드 초기 스키마
-- =============================================

-- 사용자 프로필 (Supabase Auth 연동)
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  nickname    text not null default '마음이',
  avatar_url  text,
  credits     integer not null default 3,  -- 신규 가입 무료 크레딧
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 카드
create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles on delete cascade not null,
  purpose       text not null,           -- birthday | love | thanks | ...
  recipient     text not null,           -- 받는 분 이름
  honorific     text not null default '에게', -- 에게 | 어머니 | 아버지 | 친구야 | 선생님
  message       text not null,
  background_id text not null,           -- flower | mountain | ...
  is_ai_bg      boolean not null default false,
  share_token   text unique,             -- 공유용 단축 토큰
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 기념일
create table public.anniversaries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles on delete cascade not null,
  name                text not null,      -- 어머니 생신
  date                date not null,
  anniversary_type    text not null default 'birthday', -- birthday | wedding | dating | memorial | etc
  notify_days_before  integer[] not null default '{7,1}',
  memo                text,
  created_at          timestamptz not null default now()
);

-- 결제 내역
create table public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles on delete cascade not null,
  amount      integer not null,           -- 양수: 충전, 음수: 차감
  reason      text not null,              -- 'purchase' | 'ai_generate' | 'signup_bonus'
  created_at  timestamptz not null default now()
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

alter table public.profiles             enable row level security;
alter table public.cards                enable row level security;
alter table public.anniversaries        enable row level security;
alter table public.credit_transactions  enable row level security;

-- profiles: 본인만 조회/수정
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- cards: 본인 CRUD + 공유 토큰으로 타인 조회
create policy "cards_select_own"    on public.cards for select using (auth.uid() = user_id);
create policy "cards_select_share"  on public.cards for select using (share_token is not null);
create policy "cards_insert"        on public.cards for insert with check (auth.uid() = user_id);
create policy "cards_update"        on public.cards for update using (auth.uid() = user_id);
create policy "cards_delete"        on public.cards for delete using (auth.uid() = user_id);

-- anniversaries: 본인만
create policy "anniversaries_select" on public.anniversaries for select using (auth.uid() = user_id);
create policy "anniversaries_insert" on public.anniversaries for insert with check (auth.uid() = user_id);
create policy "anniversaries_update" on public.anniversaries for update using (auth.uid() = user_id);
create policy "anniversaries_delete" on public.anniversaries for delete using (auth.uid() = user_id);

-- credit_transactions: 본인만 조회
create policy "credits_select" on public.credit_transactions for select using (auth.uid() = user_id);

-- =============================================
-- 트리거: 회원가입 시 profile 자동 생성
-- =============================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '마음이'),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 신규 가입 보너스 크레딧 기록
  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 3, 'signup_bonus');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- 트리거: updated_at 자동 갱신
-- =============================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
