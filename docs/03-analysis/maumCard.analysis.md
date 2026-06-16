---
feature: maumCard
date: 2026-06-09
phase: check
matchRate: 95
iteration: 2
---

# maumCard Gap Analysis Report (Iteration 2)

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 기성 카드 서비스는 개인화가 부족하고, 진심을 담은 메시지 전달 수단이 마땅치 않음 |
| **WHO** | 20~40대, 소중한 관계를 챙기고 싶은 사람 |
| **RISK** | AI 이미지 생성 API 비용/속도, 결제 시스템 연동 복잡도 |
| **SUCCESS** | 카드 제작 완주율 > 70%, 공유 전환율 > 50%, 결제 전환율 > 5% |
| **SCOPE** | Phase 1: 카드 제작+공유 / Phase 2: 기념일+알림 / Phase 3: AI 배경+결제 |

---

## Match Rate Summary

| Axis | Score | Weight | Contribution | vs prior |
|------|-------|--------|--------------|----------|
| Structural | 100% | 0.20 | 20.0 | = |
| Functional | 92% | 0.40 | 36.8 | +2 |
| Contract | 95% | 0.40 | 38.0 | +3 |
| **Overall** | **95%** | — | — | **+2** |

> Analysis method: Static Only. Formula: Structural×0.2 + Functional×0.4 + Contract×0.4
> Iteration 2 (2026-06-09): baseline 93% (2026-05-21). 4 of 6 prior gaps resolved (G-02/G-03/G-04/G-05).

---

## Prior Gap Resolution Status

| ID | Prior Gap | Now | Evidence |
|----|-----------|-----|----------|
| G-01 | FR-09 email notification | Still open (intentional defer) | Settings UI with honest "준비 중"/"예정" badges (`MaumCardScreens.tsx:2974-3017`). No Resend/Cron/`vercel.json`. Deferred to 2026-07. |
| G-02 | Backgrounds count (9, target 30+) | ✅ RESOLVED | `backgrounds` array = 30 entries (`MaumCardScreens.tsx:319-350`) |
| G-03 | Instagram share placeholder | ✅ RESOLVED | `handleInstagram` downloads PNG via `/api/card-image` + toast (`MaumCardScreens.tsx:2460-2470`) |
| G-04 | Naver share placeholder | ✅ RESOLVED | `handleNaver` opens `share.naver.com` (`MaumCardScreens.tsx:2472-2476`) |
| G-05 | MyPage notification settings placeholder | ✅ RESOLVED | Full `notifications` view D-7/D-1/card-receipt (`MaumCardScreens.tsx:2974-3017`) |
| G-06 | No integration tests | Still open | No test/spec files; no vitest/playwright config |

---

## Functional Requirements Coverage (FR-01 ~ FR-13)

| FR | Status | Evidence |
|----|--------|----------|
| FR-01 목적 선택 8종 | ✅ | 9 purposes incl. `hand`/`custom` (`MaumCardScreens.tsx:49`) |
| FR-02 글귀 입력/추천 | ✅ | Direct input + `messagesByPurpose`; `favoriteMessages` |
| FR-03 배경 30장+ | ✅ | 30 backgrounds (`MaumCardScreens.tsx:319-350`) |
| FR-04 PNG 다운로드 | ✅ | `/api/card-image` sharp server render |
| FR-05 카카오/인스타/URL 공유 | ✅ | Kakao SDK + Instagram + Naver + Facebook + navigator.share (`MaumCardScreens.tsx:2456-2484`) |
| FR-06 최근 카드 목록 | ✅ | `useSupabaseCards` + `getMyCards` (`lib/cards.ts:38`) |
| FR-07 기념일 등록/수정/삭제 | ✅ | `/api/anniversaries` GET/POST/DELETE + `lib/anniversaries.ts` |
| FR-08 달력 뷰 | ✅ | `AnniversaryCalendar` |
| FR-09 D-7/D-1 이메일 알림 | ⚠️ Partial | UI present, send pipeline absent — see G-01 |
| FR-10 AI 배경 생성 | ✅ | `/api/ai-background` + `useAIBackground` (gpt-image-2, picsum fallback) |
| FR-11 크레딧 차감 | ✅ | `profiles.credits -1` + `credit_transactions` (`ai-background/route.ts:47-56`) |
| FR-12 결제 카카오페이/신용카드 | ✅ | Toss confirm + `PLANS` 1,900원/14,900원 (`toss.ts:48-51`) |
| FR-13 카카오 소셜 로그인 | ✅ | Supabase Auth + `/auth/callback` |

---

## Success Criteria Evaluation

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Phase 1: 카드 제작~공유 완주 | ✅ Met | create → message → background → preview → ShareSheet |
| Phase 2: 기념일 등록 후 달력 확인 | ✅ Met | anniversaries page + calendar |
| Phase 2: 알림 수신 확인 | ❌ Not Met | No send pipeline (G-01) |
| Phase 3: 결제→크레딧→AI 완주 | ✅ Met | Toss → credits → ai-background |
| 모든 화면 모바일 반응형 | ✅ Met | `max-w-md` mobile-first throughout |
| TS 0 errors / ESLint 0 errors | ⚠️ Unverified (static) | needs `tsc --noEmit` at runtime |
| 핵심 API 통합 테스트 | ❌ Not Met | No tests (G-06) |

**Success Rate: 5/7 fully met (71%)**

---

## API Contract Verification (3-way)

| Endpoint | Method | Server Shape | Client Consumption | Auth | Contract |
|----------|--------|--------------|--------------------|------|----------|
| /api/cards | GET/POST | `{cards}` / `{card}` 201 | Unused — client uses `lib/cards.ts` (Supabase direct, RLS) | 401 | PASS (orphaned) |
| /api/anniversaries | GET/POST/DELETE | `{anniversaries}`/`{anniversary}`/`{ok}` | `lib/anniversaries.ts` Supabase direct | 401 | PASS |
| /api/payments | POST | `{status, credits}` / `{error}` 400/401 | `payment/success/page.tsx:43` | 401 + Toss verify | PASS |
| /api/ai-background | POST | `{backgroundUrl, isAiGenerated}` / `{error,code}` 402 | `useAIBackground.ts:50` | optional | PASS |
| /api/card-image | GET/POST | image/png | `<img>`/download anchor | — | PASS |
| /api/settings | GET | flat settings object | `usePublicUiSettings` | none (admin client) | PASS |

> Note: `/api/cards` route exists but is effectively dead code — persistence goes through `lib/cards.ts` Supabase-direct (RLS-protected). Functional, but a Plan §7.3 drift.

---

## Gap List

### CRITICAL
| # | Gap | Location | Impact |
|---|-----|----------|--------|
| G-01 | FR-09 email notification has no send pipeline | No Resend/SendGrid/Cron; `vercel.json` absent | Phase 2 Success Criterion unmet. UI honestly labels "준비 중". |

### IMPORTANT
| # | Gap | Location | Impact |
|---|-----|----------|--------|
| G-06 | No automated tests | No `*.test/*.spec`; no vitest/playwright config | Quality Criterion + DoD "핵심 API 통합 테스트 통과" unmet |
| G-07 (new) | Architecture drift — empty feature-module scaffolds | `src/features/card-create/components/*.tsx` (0 bytes), `useCardCreate.ts`, unused `cardEditorStore.ts` | Plan §7.3 specified feature modules; reality is monolithic `MaumCardScreens.tsx` (~3000 lines). Empty stubs mislead. |

### MINOR
| # | Gap | Location | Impact |
|---|-----|----------|--------|
| G-08 (new) | State mgmt diverged from Plan | Plan §7.2 chose Zustand/TanStack Query; draft uses localStorage `useDraft` (`MaumCardScreens.tsx:387-405`) | Decision-record deviation; works fine |
| G-09 (new) | Orphaned `PageHeader.tsx` with TODO | `src/components/layout/PageHeader.tsx:11` | Dead component, screens use inline `ChevronLeft` |

---

## Runtime Verification Plan

### L1 — API Endpoint Tests (curl)
| # | Test | Expected |
|---|------|----------|
| 1 | GET /api/cards (no auth) | 401, `.error="Unauthorized"` |
| 2 | GET /api/anniversaries (no auth) | 401 |
| 3 | POST /api/payments `{}` | 400, "결제 정보가 누락" |
| 4 | POST /api/payments amount mismatch | 400, "금액이 일치하지 않" |
| 5 | POST /api/ai-background `{}` | 400, "prompt is required" |
| 6 | GET /api/settings | 200, `.ai_suggestions_enabled` |
| 7 | DELETE /api/anniversaries (no id) | 400, "id required" |

### L2 — UI Action Tests (Playwright)
| # | Page | Action | Expected |
|---|------|--------|----------|
| 1 | `/` | Unauthed visit | Redirect to `/login` |
| 2 | `/create` | purpose → next | message step, draft persists |
| 3 | `/create/preview` | share | ShareSheet Kakao/Naver/Instagram/FB |
| 4 | `/mypage` | 알림 설정 | "이메일 알림 서비스 준비 중" |
| 5 | `/admin/*` (non-admin) | visit | Redirect to `/` |

### L3 — E2E Scenarios (Playwright)
| # | Scenario | Success |
|---|----------|---------|
| 1 | Card creation flow | Card saved, PNG downloads |
| 2 | Share flow (Naver) | new tab share.naver.com |
| 3 | Payment flow | success page "크레딧 충전", redirect /mypage |
| 4 | AI background + credit | image, `credits -1`, `credit_transactions` row |
| 5 | Credit guard (0 credits) | 402, "크레딧이 부족합니다" |

> Suggested test file: `tests/e2e/maumcard-mvp.spec.ts`

---

## Verdict

**Overall Match Rate 95% (static)** — up from 93%, exceeds 90% target → proceed to QA or `/pdca report`.
Two known gaps (G-01 email send, G-06 tests) are documented/deferred, not broken.
New findings (G-07/G-08/G-09) are cleanliness/drift issues, not functional defects.

## Next Steps
- ≥90% → `/pdca qa maumCard` (runtime L1-L3) or `/pdca report maumCard`
- Optional cleanup: `/simplify` to remove orphaned stubs (G-07/G-09)
