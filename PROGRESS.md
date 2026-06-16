# 마음카드 개발 진행상황

> 최종 업데이트: 2026-05-26

---

## 현재 상태

```
Phase 1 (카드 제작·공유): █████████░ 90%
Phase 2 (기념일 관리):    ███████░░░ 70%
Phase 3 (AI·결제):        ████████░░ 80%
```

---

## Phase 1 — 카드 제작 & 공유

| 상태 | 항목 | 파일 |
|:---:|------|------|
| ✅ | 홈 화면 + 최근 카드 그리드/샘플 빈 상태 | `MaumCardScreens → HomeScreen` |
| ✅ | 목적 선택 9종 (생일/안부/건강/감사/위로/명절/아침/저녁/직접입력) | `PurposeScreen` |
| ✅ | 받는 분 이름 + 호칭 선택 | `MessageScreen` |
| ✅ | 추천 글귀 선택 / 직접 입력 | `MessageScreen` |
| ✅ | 배경 갤러리 (DB 저장 배경) | `BackgroundScreen → gallery 탭` |
| ✅ | 기본 CSS 그라디언트 배경 9종 | `BackgroundScreen → basic 탭` |
| ✅ | AI 배경 생성 (문구/받는 분 문맥 반영, 크레딧 1개 소모) | `BackgroundScreen → ai 탭`, `api/ai-background` |
| ✅ | 카드 미리보기 (API 생성 PNG, 3:4 세로 비율) | `PreviewScreen + api/card-image` |
| ✅ | PNG 다운로드 (서버 생성 이미지) | `PreviewScreen → downloadCard` |
| ✅ | 카카오톡 공유 | `ShareSheet → Kakao` |
| ✅ | URL 복사 / 소셜 공유 시트 | `ShareSheet` |
| ✅ | 카드 Supabase 저장 + 로컬 fallback | `lib/cards.ts` |
| ✅ | 카드 공유 페이지 (`/share/[cardId]`) + OG 메타태그 | `app/share/[cardId]` |
| ✅ | 홈 최근 카드 목록 그리드 (최근 4개 + 전체보기 링크) | `HomeScreen` |
| ✅ | 추천 글귀 목적별 분류 | `MessageScreen` |
| ⚠️ | 인스타그램 공유 (현재 window.alert 스텁) | `ShareSheet` |
| ✅ | AI 추천 글귀 (OpenAI 기반, fallback 포함) | `MessageScreen → ai 탭`, `api/ai-message` |

---

## Phase 2 — 기념일 관리

| 상태 | 항목 | 파일 |
|:---:|------|------|
| ✅ | 기념일 등록 (이름/날짜/종류/메모) | `AnniversaryScreen → add` |
| ✅ | 기념일 삭제 | `AnniversaryScreen → manage` |
| ✅ | 달력 뷰 (월별, 기념일 표시) | `AnniversaryScreen → calendar` |
| ✅ | D-Day 카운트다운 | `getDDay()` |
| ✅ | 다가오는 기념일 목록 (상위 5개) | `AnniversaryScreen → home` |
| ✅ | 기념일 → 카드 만들기 링크 | 달력 상세 → `/create` |
| ✅ | 기념일 수정 (edit) | `AnniversaryScreen → manage/edit` |
| ❌ | 기념일 D-7, D-1 이메일 알림 | 서버 크론 필요, 미구현 |
| ✅ | 기념일 → 카드 목적 자동 세팅 | 기념일 종류 → purpose 자동 매핑 후 /create/message로 이동 |

---

## Phase 3 — AI 배경 + 결제

| 상태 | 항목 | 파일 |
|:---:|------|------|
| ✅ | 이메일 매직링크 로그인 (Supabase Auth) | `lib/auth.ts`, `app/(auth)/login` |
| ⚠️ | 카카오 소셜 로그인 (비즈 앱 전환 전까지 UI 비활성화) | Supabase Kakao provider |
| ✅ | 회원가입 시 프로필 자동 생성 + 크레딧 3개 지급 | `migrations/001_init.sql` |
| ✅ | AI 배경 생성 API (OpenAI gpt-image-1) | `api/ai-background` |
| ✅ | AI 추천 글귀 API (OpenAI text model) | `api/ai-message` |
| ✅ | AI 생성 시 크레딧 1개 차감 | `api/ai-background` |
| ✅ | 크레딧 부족 시 402 에러 + 안내 메시지 | `useAIBackground` |
| ✅ | 크레딧 충전 (Toss Payments) | `PaymentModal + api/payments` |
| ✅ | 결제 성공/실패 페이지 | `app/payment/success|fail` |
| ✅ | 구매 내역 DB 기록 (credit_transactions) | `api/payments` |
| ✅ | 마이페이지 크레딧 잔액 표시 + 충전 버튼 | `MyPageScreen + CreditBalance` |
| ⚠️ | 카카오페이 결제 옵션 (Toss SDK로 가능하나 UI 미노출) | `PaymentModal` |
| ✅ | 구매 내역 페이지 | `MyPageScreen → 구매 내역` |

---

## 배경 관리 (어드민)

| 상태 | 항목 | 파일 |
|:---:|------|------|
| ✅ | 배경 관리자 페이지 (`/admin/backgrounds`) | `app/admin/backgrounds` |
| ✅ | OpenAI로 배경 생성 (9:16 → 3:4 세로 비율) | `api/admin/backgrounds` |
| ✅ | Supabase Storage 업로드 | `api/admin/backgrounds` |
| ✅ | 배경 DB 저장 (name, category, url, prompt) | `migrations/002_backgrounds.sql` |
| ✅ | 배경 활성화/비활성화 토글 | 관리자 페이지 |
| ✅ | 배경 삭제 (Storage + DB 동시) | 관리자 페이지 |
| ✅ | 관리자 페이지 하단 네비게이션 유지 | `app/admin/backgrounds` |
| ✅ | Storage public read policy — migration 004_storage_policies.sql 추가 (버킷 public 설정 + RLS) | Supabase Storage |

---

## 마이페이지

| 상태 | 항목 |
|:---:|------|
| ✅ | 프로필 사진 + 닉네임 + 크레딧 |
| ✅ | 로그아웃 |
| ✅ | 내 정보 관리 (닉네임 변경) |
| ✅ | 내가 만든 카드 목록 페이지 |
| ✅ | 즐겨찾기 문구 관리 (저장/목록/삭제/카드에 사용) |
| ✅ | 구매 내역 페이지 |
| ❌ | 알림 설정 |

---

## 기술 현황

| 항목 | 상태 |
|------|------|
| TypeScript 에러 | ✅ 0개 |
| Next.js 빌드 | ✅ 통과 |
| 의존성 설치 상태 | ✅ `node_modules` / Next SWC / `.bin` shim 복구 완료 |
| Supabase DB 스키마 | ✅ profiles, cards, anniversaries, credit_transactions, backgrounds |
| RLS 설정 | ✅ 전 테이블 적용 |
| 미들웨어 (인증) | ✅ 전 페이지 보호 |
| 카드 비율 | ✅ 3:4 세로형 |

---

## 다음 우선순위

1. ~~Supabase Storage public read policy 확인~~ ✅
2. ~~즐겨찾기 문구 관리~~ ✅
3. 알림 설정 (D-7, D-1 이메일 알림 — 크론 서버 필요)
4. ~~기념일 → 카드 목적 자동 세팅~~ ✅
5. 인스타그램 공유 개선
6. **Supabase migration 실행 필요**: `005_favorite_messages.sql` 및 `004_storage_policies.sql` 대시보드에서 적용

---

## 환경변수 체크리스트

```env
NEXT_PUBLIC_SUPABASE_URL=         ✓ 필수
NEXT_PUBLIC_SUPABASE_ANON_KEY=    ✓ 필수
SUPABASE_SERVICE_ROLE_KEY=        ✓ 관리자 API 필수
NEXT_PUBLIC_KAKAO_API_KEY=        ✓ 카카오 공유
NEXT_PUBLIC_TOSS_CLIENT_KEY=      ✓ 결제
TOSS_SECRET_KEY=                  ✓ 결제 서버 검증
OPENAI_API_KEY=                   ✓ AI 배경 생성
OPENAI_TEXT_MODEL=                선택, 기본 gpt-5.5
NEXT_PUBLIC_APP_URL=              ✓ 공유 URL
```
