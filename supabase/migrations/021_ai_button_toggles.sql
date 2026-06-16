-- AI 버튼 노출 토글 (디폴트 비활성화)
--  ai_background_enabled: /create/background 의 "✨ AI 생성" 탭 노출 여부
--  ai_compose_enabled   : /create/message 의 "AI로 만들기" 버튼 노출 여부
alter table public.system_settings
  add column if not exists ai_background_enabled boolean not null default false,
  add column if not exists ai_compose_enabled boolean not null default false;
