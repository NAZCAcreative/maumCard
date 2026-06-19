-- 빈영역 탐지 테스트 UI 노출 토글 (디폴트 비활성화 = 숨김)
--  whitespace_test_enabled: /create/preview 의 "🔍 빈영역 탐지 테스트" 패널 노출 여부
alter table public.system_settings
  add column if not exists whitespace_test_enabled boolean not null default false;
