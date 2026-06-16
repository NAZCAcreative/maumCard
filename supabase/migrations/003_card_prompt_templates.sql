-- =============================================
-- Card background prompt templates
-- =============================================

create table public.card_prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  purpose     text not null,
  name        text not null,
  description text not null,
  template    text not null,
  style       text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.card_prompt_templates enable row level security;

create policy "card_prompt_templates_public_read"
  on public.card_prompt_templates
  for select using (is_active = true);

create trigger card_prompt_templates_updated_at
  before update on public.card_prompt_templates
  for each row execute procedure public.set_updated_at();

insert into public.card_prompt_templates (
  code,
  purpose,
  name,
  description,
  template,
  style,
  sort_order
) values (
  'BIRTHDAY_FLOWER_WARM',
  'birthday',
  'Warm birthday flower blessing',
  '생일을 맞은 사람에게 따뜻한 축하와 건강을 기원하는 카드.',
  '{BASE_SENIOR_CARD}

이번 카드는 생일 축하 카드다.
받는 사람 이름은 "{recipientName}"이다.
카드 문구는 "{message}"이다.

디자인 방향:
- 생일 케이크보다 꽃과 따뜻한 축복 중심
- 부모님 세대가 좋아할 부드러운 축하 분위기
- 과하게 화려하지 않고 정갈한 생일 축하 감성
- 꽃잎, 은은한 빛, 따뜻한 배경 사용
- 문구가 가장 잘 보이도록 여백 확보

사용자가 추가로 요청한 분위기:
{userPrompt}',
  'soft flower background, warm birthday blessing, elegant pastel floral card',
  10
) on conflict (code) do update set
  purpose = excluded.purpose,
  name = excluded.name,
  description = excluded.description,
  template = excluded.template,
  style = excluded.style,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
