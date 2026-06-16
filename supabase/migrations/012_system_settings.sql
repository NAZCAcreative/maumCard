-- 시스템 설정 (싱글톤 row)
create table if not exists public.system_settings (
  id                    text primary key default 'default',
  signup_bonus_credits  integer not null default 3,
  updated_at            timestamptz not null default now()
);

-- 기본 설정 row 삽입
insert into public.system_settings (id, signup_bonus_credits)
values ('default', 3)
on conflict (id) do nothing;

-- RLS: 서비스 role만 접근 (공개 정책 없음)
alter table public.system_settings enable row level security;

-- handle_new_user: 하드코딩 3 → system_settings 참조
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bonus integer;
begin
  select coalesce(signup_bonus_credits, 3)
    into bonus
    from public.system_settings
   where id = 'default';

  bonus := coalesce(bonus, 3);

  insert into public.profiles (id, nickname, avatar_url, credits)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '마음이'),
    new.raw_user_meta_data->>'avatar_url',
    bonus
  );

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, bonus, 'signup_bonus');

  return new;
end;
$$;
