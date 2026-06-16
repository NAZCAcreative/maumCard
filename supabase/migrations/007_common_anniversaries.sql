create table if not exists public.common_anniversaries (
  id text primary key,
  name text not null,
  month integer,
  day integer,
  yearly_dates jsonb not null default '{}'::jsonb,
  anniversary_type text not null default 'other',
  memo text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint common_anniversaries_date_check check (
    (month is not null and day is not null) or yearly_dates <> '{}'::jsonb
  )
);

create table if not exists public.common_anniversary_settings (
  id text primary key default 'home',
  max_visible integer not null default 3,
  window_days integer not null default 7,
  updated_at timestamptz not null default now(),
  constraint common_anniversary_settings_singleton check (id = 'home'),
  constraint common_anniversary_settings_max_check check (max_visible between 1 and 12),
  constraint common_anniversary_settings_window_check check (window_days between 0 and 365)
);

alter table public.common_anniversaries enable row level security;
alter table public.common_anniversary_settings enable row level security;

drop policy if exists "common_anniversaries_public_read" on public.common_anniversaries;
create policy "common_anniversaries_public_read" on public.common_anniversaries
  for select using (true);

drop policy if exists "common_anniversary_settings_public_read" on public.common_anniversary_settings;
create policy "common_anniversary_settings_public_read" on public.common_anniversary_settings
  for select using (true);

insert into public.common_anniversary_settings (id, max_visible, window_days)
values ('home', 3, 7)
on conflict (id) do nothing;

insert into public.common_anniversaries (id, name, month, day, yearly_dates, anniversary_type, memo, sort_order)
values
  ('new-year', '양력 설', 1, 1, '{}'::jsonb, 'other', '새해 인사를 전하기 좋은 날', 10),
  ('seollal', '설날', null, null, jsonb_build_object('2026', '2026-02-17', '2027', '2027-02-06'), 'family', '가족에게 새해 인사를 전하세요', 20),
  ('daeboreum', '정월대보름', null, null, jsonb_build_object('2026', '2026-03-03', '2027', '2027-02-21'), 'other', '한 해의 건강과 안녕을 기원하는 날', 30),
  ('valentine', '발렌타인데이', 2, 14, '{}'::jsonb, 'love', '좋아하는 마음을 전하세요', 40),
  ('independence', '삼일절', 3, 1, '{}'::jsonb, 'other', '나라를 생각하는 기념일', 50),
  ('white-day', '화이트데이', 3, 14, '{}'::jsonb, 'love', '고마운 마음을 다정하게 전하세요', 60),
  ('arbor-day', '식목일', 4, 5, '{}'::jsonb, 'other', '봄의 마음을 나누기 좋은 날', 70),
  ('black-day', '블랙데이', 4, 14, '{}'::jsonb, 'friendship', '혼자여도 괜찮다는 응원을 보내세요', 80),
  ('labor-day', '근로자의 날', 5, 1, '{}'::jsonb, 'thanks', '수고한 사람에게 고마움을 전하세요', 90),
  ('children-day', '어린이날', 5, 5, '{}'::jsonb, 'family', '아이에게 사랑과 응원을 전하세요', 100),
  ('parents-day', '어버이날', 5, 8, '{}'::jsonb, 'family', '부모님께 감사 인사를 전하세요', 110),
  ('buddha', '부처님오신날', null, null, jsonb_build_object('2026', '2026-05-24', '2027', '2027-05-13'), 'other', '평온한 마음을 나누는 날', 120),
  ('teacher-day', '스승의 날', 5, 15, '{}'::jsonb, 'thanks', '선생님께 감사한 마음을 전하세요', 130),
  ('adult-day', '성년의 날', null, null, jsonb_build_object('2026', '2026-05-18', '2027', '2027-05-17'), 'congrats', '새로운 시작을 축하하세요', 140),
  ('dano', '단오', null, null, jsonb_build_object('2026', '2026-06-19', '2027', '2027-06-09'), 'other', '여름을 맞는 전통 명절', 150),
  ('memorial-day', '현충일', 6, 6, '{}'::jsonb, 'other', '감사와 추모의 마음을 전하세요', 160),
  ('korean-war', '6.25 전쟁일', 6, 25, '{}'::jsonb, 'other', '기억과 평화를 생각하는 날', 170),
  ('constitution', '제헌절', 7, 17, '{}'::jsonb, 'other', '대한민국 헌법을 기념하는 날', 180),
  ('chilseok', '칠석', null, null, jsonb_build_object('2026', '2026-08-19', '2027', '2027-08-08'), 'love', '그리운 마음을 떠올리는 날', 190),
  ('liberation', '광복절', 8, 15, '{}'::jsonb, 'other', '광복의 의미를 기억하는 날', 200),
  ('chuseok', '추석', null, null, jsonb_build_object('2026', '2026-09-25', '2027', '2027-09-14'), 'family', '가족과 풍요를 나누는 명절', 210),
  ('armed-forces', '국군의 날', 10, 1, '{}'::jsonb, 'other', '헌신에 감사하는 날', 220),
  ('foundation', '개천절', 10, 3, '{}'::jsonb, 'other', '하늘이 열린 날을 기념하세요', 230),
  ('hangul', '한글날', 10, 9, '{}'::jsonb, 'other', '우리말과 글의 소중함을 나누는 날', 240),
  ('halloween', '할로윈', 10, 31, '{}'::jsonb, 'friendship', '가볍고 즐거운 안부를 전하세요', 250),
  ('pepero', '빼빼로데이', 11, 11, '{}'::jsonb, 'friendship', '친구와 연인에게 마음을 전하세요', 260),
  ('farmers', '농업인의 날', 11, 11, '{}'::jsonb, 'thanks', '수확과 먹거리에 감사하는 날', 270),
  ('martyrs', '순국선열의 날', 11, 17, '{}'::jsonb, 'other', '헌신을 기억하는 날', 280),
  ('dongji', '동지', null, null, jsonb_build_object('2026', '2026-12-22', '2027', '2027-12-22'), 'other', '긴 밤을 지나 새 기운을 맞는 날', 290),
  ('christmas-eve', '크리스마스 이브', 12, 24, '{}'::jsonb, 'love', '따뜻한 안부를 전하세요', 300),
  ('christmas', '성탄절', 12, 25, '{}'::jsonb, 'family', '사랑과 평안을 전하세요', 310),
  ('year-end', '연말', 12, 31, '{}'::jsonb, 'thanks', '한 해의 고마움을 전하세요', 320)
on conflict (id) do update set
  name = excluded.name,
  month = excluded.month,
  day = excluded.day,
  yearly_dates = excluded.yearly_dates,
  anniversary_type = excluded.anniversary_type,
  memo = excluded.memo,
  sort_order = excluded.sort_order,
  updated_at = now();
