-- 버튼 클릭 효과 및 개별 폰트 활성화 설정 컬럼 추가
-- click_effect_bubbles_enabled: 파티클 방울 클릭 효과 활성화 여부 (기본값 true)
-- click_effect_spring_enabled: 버튼 누를 때 팅기는 용수철 효과 활성화 여부 (기본값 true)
-- enabled_fonts: 활성화된 개별 폰트 ID 목록 (기본값: 전체 28종 폰트 활성화)

alter table public.system_settings
  add column if not exists click_effect_bubbles_enabled boolean not null default true,
  add column if not exists click_effect_spring_enabled boolean not null default true,
  add column if not exists enabled_fonts jsonb not null default '["pen", "brush", "gamja", "himelody", "poorstory", "gaegu", "gaegubold", "cutefont", "dokdo", "eastsea", "kirang", "singleday", "yeonsung", "serif", "nanummyeongjo", "songmyung", "diphylleia", "stylish", "nanumgothic", "gowundodum", "gothica1", "nanumcoding", "sunflower", "blackhan", "dohyeon", "jua", "gugi", "bwpicture"]'::jsonb;
