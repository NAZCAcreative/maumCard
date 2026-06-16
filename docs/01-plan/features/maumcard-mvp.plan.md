---
template: plan
version: 1.3
feature: maumcard-mvp
date: 2026-05-14
author: dkpark55@gmail.com
project: maumCard
status: Draft
---

# 마음카드 MVP 기획 문서

> **Summary**: 기념일에 감동적인 카드를 직접 만들어 소중한 사람에게 전달하는 Next.js 웹앱
>
> **Project**: maumCard
> **Version**: 0.1.0
> **Author**: dkpark55@gmail.com
> **Date**: 2026-05-14
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 기념일에 진심을 담은 메시지를 전달하고 싶지만 막막하거나, 기성 카드는 개인화가 부족하다 |
| **Solution** | 글귀 + 배경 이미지(직접 선택 or AI 생성)를 조합해 나만의 디지털 카드를 쉽게 만들고 공유하는 웹앱 |
| **Function/UX Effect** | 5분 이내에 감동적인 카드를 완성 → 카카오톡·인스타그램으로 바로 공유, 기념일 알림으로 잊지 않도록 |
| **Core Value** | 마음을 담은 개인화 카드 + AI 배경 생성 + 기념일 관리 통합 서비스 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 기성 카드 서비스는 개인화가 부족하고, 진심을 담은 메시지 전달 수단이 마땅치 않음 |
| **WHO** | 20~40대, 소중한 관계를 챙기고 싶은 사람 (생일·기념일 선물 대용으로 카드를 활용하는 사용자) |
| **RISK** | AI 이미지 생성 API 비용/속도, 결제 시스템 연동 복잡도, 카드 에디터 퍼포먼스 |
| **SUCCESS** | 카드 제작 완주율 > 70%, 공유 전환율 > 50%, 결제 전환율 > 5% |
| **SCOPE** | Phase 1: 카드 제작 + 공유 / Phase 2: 기념일 관리 + 알림 / Phase 3: AI 배경 + 결제 |

---

## 1. Overview

### 1.1 Purpose

사용자가 기념일(생일, 감사, 사랑, 응원 등)에 맞는 개인화 디지털 카드를 5분 내에 만들어 카카오톡·인스타그램 등으로 바로 공유할 수 있도록 한다.

### 1.2 Background

- 기존 카드 서비스는 템플릿 선택 후 텍스트만 입력하는 방식으로 개인화 한계
- SNS 공유에 최적화된 카드 포맷(정사각형 1:1, 세로형 9:16) 미지원
- 기념일 관리와 카드 제작이 분리되어 있어 UX 흐름이 끊김
- AI 이미지 생성 기술로 배경 개인화 비용이 크게 낮아짐

### 1.3 Related Documents

- 참고 이미지: `startImg/` 폴더 (화면 플로우 4장)
- 결제 프로세스: `startImg/ChatGPT Image 2026년 5월 12일 오전 04_16_01.png`
- 전체 플로우도: `startImg/ChatGPT Image 2026년 5월 12일 오전 04_28_41.png`

---

## 2. Scope

### 2.1 In Scope (MVP)

**Phase 1 — 카드 제작 & 공유 (핵심 가치 검증)**
- [ ] 홈 화면: 카드 만들기 진입 + 최근 카드 목록
- [ ] 메시지 목적 선택: 생일 / 감사 / 사랑 / 응원 / 위로 / 축하 등 카테고리
- [ ] 글귀 입력: 직접 입력 or 추천 글귀 선택
- [ ] 배경 선택: 큐레이팅된 배경 이미지 라이브러리 (30~50장)
- [ ] 카드 미리보기 & 다운로드 (PNG)
- [ ] 소셜 공유: 카카오톡, 인스타그램, URL 복사

**Phase 2 — 기념일 관리**
- [ ] 기념일 등록/수정/삭제 (이름, 날짜, 종류)
- [ ] 달력 뷰 (다가오는 기념일 표시)
- [ ] 기념일 D-Day 알림 (이메일)
- [ ] 기념일 → 카드 제작 연동 (기념일 선택 시 카드 목적 자동 세팅)

**Phase 3 — AI 배경 + 결제**
- [ ] AI 배경 생성: 키워드/감정 입력 → AI 이미지 생성
- [ ] 마음카드 크레딧 시스템 (AI 생성 = 크레딧 차감)
- [ ] 결제: 카카오페이, 신용카드 (1,900원 / 14,900원 플랜)
- [ ] 회원가입/로그인 (소셜 로그인: 카카오)

### 2.2 Out of Scope

- 실물 카드 인쇄/배송 서비스
- 동영상 카드 (GIF 포함)
- 다국어 지원 (한국어 전용 MVP)
- 팀/그룹 연명 카드
- 카드 수신자 플로우 (수신자가 앱에서 확인하는 기능)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-01 | 사용자는 메시지 목적(생일/감사 등 8종)을 선택할 수 있다 | High | 1 |
| FR-02 | 사용자는 글귀를 직접 입력하거나 추천 글귀(카테고리별 5개)를 선택할 수 있다 | High | 1 |
| FR-03 | 사용자는 배경 이미지 라이브러리(30장+)에서 배경을 선택할 수 있다 | High | 1 |
| FR-04 | 완성된 카드를 PNG로 다운로드할 수 있다 | High | 1 |
| FR-05 | 완성된 카드를 카카오톡 공유, 인스타그램 공유, URL 복사로 공유할 수 있다 | High | 1 |
| FR-06 | 사용자는 최근 제작한 카드 목록을 홈 화면에서 볼 수 있다 | Medium | 1 |
| FR-07 | 기념일을 이름/날짜/종류로 등록하고 관리할 수 있다 | High | 2 |
| FR-08 | 달력 뷰에서 등록된 기념일을 확인할 수 있다 | Medium | 2 |
| FR-09 | 기념일 D-7, D-1에 이메일 알림을 받을 수 있다 | Medium | 2 |
| FR-10 | AI에게 키워드/감정을 입력하면 배경 이미지를 생성받을 수 있다 | High | 3 |
| FR-11 | 크레딧 시스템: AI 생성 1회 = 크레딧 1개 차감 | High | 3 |
| FR-12 | 카카오페이 / 신용카드로 크레딧을 구매할 수 있다 | High | 3 |
| FR-13 | 카카오 소셜 로그인으로 가입/로그인할 수 있다 | High | 3 |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 카드 미리보기 렌더링 < 1초 | Lighthouse / Chrome DevTools |
| Performance | AI 배경 생성 < 10초 (스트리밍 프로그레스 표시) | API 응답 시간 측정 |
| Accessibility | WCAG 2.1 AA 준수 | axe DevTools |
| Responsive | 모바일(375px) ~ 데스크탑(1280px) 완전 지원 | Chrome DevTools |
| SEO | OG 태그로 공유 카드 미리보기 지원 | 카카오 디버거 검증 |
| Security | 결제 정보 서버사이드 처리, PG사 직접 통신 | 코드 리뷰 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] Phase 1: 카드 제작 ~ 공유까지 한 번에 완주 가능
- [ ] Phase 2: 기념일 등록 후 달력에서 확인, 알림 수신 확인
- [ ] Phase 3: 결제 → 크레딧 충전 → AI 생성 플로우 완주
- [ ] 모든 화면 모바일 반응형 완성
- [ ] TypeScript 타입 에러 0개, ESLint 에러 0개
- [ ] 핵심 API (카드 저장, 결제) 통합 테스트 통과

### 4.2 Quality Criteria

- [ ] Lighthouse Performance 점수 > 85
- [ ] 카드 제작 완주율 > 70% (퍼널 분석)
- [ ] 카드 공유 전환율 > 50% (완주자 중)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI 이미지 생성 API 비용 초과 | High | Medium | 무료 크레딧 3개 제공, 생성 전 비용 안내, rate limiting |
| 카카오 공유 SDK 정책 변경 | Medium | Low | URL 공유(OG 태그) 폴백 항상 유지 |
| html2canvas 카드 렌더링 품질 | Medium | High | fabric.js 또는 konva.js 대안 검토, 서버사이드 렌더링 검토 |
| 결제 PG 연동 복잡도 | High | Medium | 토스페이먼츠 SDK 활용 (카카오페이 포함), 샌드박스 먼저 구현 |
| 모바일 Safari 호환성 | Medium | Medium | iOS 실기기 테스트, CSS 벤더 프리픽스 적용 |

---

## 6. Impact Analysis

> 신규 프로젝트이므로 기존 코드베이스 영향 없음

### 6.1 External Service Dependencies

| Service | Purpose | Cost | Risk |
|---------|---------|------|------|
| OpenAI DALL-E 3 / Stable Diffusion | AI 배경 생성 | 이미지당 약 $0.04 | API 지연, 비용 |
| 토스페이먼츠 | 결제 PG | 거래당 수수료 | 연동 복잡도 |
| 카카오 SDK | 로그인 + 공유 | 무료 | 정책 변경 |
| Cloudinary / Supabase Storage | 카드 이미지 저장 | 무료 티어 충분 | 용량 한계 |
| Vercel | 배포 | 무료 티어 | - |

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| **Starter** | 정적 사이트 | ☐ |
| **Dynamic** | 기능 기반 모듈, BaaS 통합 | ✅ |
| **Enterprise** | 마이크로서비스 | ☐ |

**선택: Dynamic** — 결제·AI·소셜 연동이 있는 풀스택 앱이지만 팀 규모가 작고 빠른 MVP 검증이 목표

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React | **Next.js 14 (App Router)** | SSR(OG 태그), API Routes, 배포 용이성 |
| State Management | Context / Zustand / Jotai | **Zustand** | 카드 에디터 상태 관리, 경량, TypeScript 친화적 |
| API Client | fetch / axios / react-query | **TanStack Query** | 캐싱, 로딩/에러 상태 통합 |
| Form Handling | react-hook-form / native | **react-hook-form + zod** | 결제 폼, 기념일 입력 검증 |
| Styling | Tailwind / CSS Modules | **Tailwind CSS** | 빠른 개발, 반응형 유틸리티 |
| Canvas/카드 렌더 | html2canvas / konva.js | **html2canvas + React DOM** | 초기 구현 단순화 (품질 이슈 시 konva 전환) |
| Backend | bkend.ai / Supabase / Custom | **Supabase** | Auth + DB + Storage 통합, 무료 티어 |
| Testing | Jest / Vitest / Playwright | **Vitest + Playwright** | Vite 기반 빠른 단위테스트 + E2E |

### 7.3 폴더 구조 (Dynamic Level)

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # 로그인/회원가입
│   ├── (main)/                 # 홈, 카드 제작, 기념일
│   │   ├── page.tsx            # 홈 (100. 홈 뷰편)
│   │   ├── create/             # 카드 제작 플로우 (200~600)
│   │   └── anniversaries/      # 기념일 관리
│   ├── api/                    # API Routes
│   │   ├── cards/
│   │   ├── anniversaries/
│   │   ├── payments/
│   │   └── ai-background/
│   └── share/[cardId]/         # 공유 카드 뷰 (OG 태그)
├── components/
│   ├── ui/                     # shadcn/ui 기반 공통 컴포넌트
│   ├── card-editor/            # 카드 에디터 컴포넌트
│   └── anniversary/            # 기념일 관련 컴포넌트
├── features/
│   ├── card-create/            # 카드 제작 feature
│   ├── anniversary/            # 기념일 관리 feature
│   └── payment/                # 결제 feature
├── lib/
│   ├── supabase.ts
│   ├── kakao.ts
│   └── toss-payments.ts
└── types/
```

---

## 8. Convention Prerequisites

### 8.1 Conventions to Define

| Category | Rule |
|----------|------|
| **컴포넌트 네이밍** | PascalCase, 파일명 = 컴포넌트명 |
| **폴더 네이밍** | kebab-case |
| **API Routes** | RESTful, `/api/{resource}/{id}` |
| **타입 정의** | `types/` 폴더 집중, interface 우선 |
| **에러 처리** | API Route: `{ error: string, code: string }` 형식 통일 |
| **환경 변수** | NEXT_PUBLIC_ 접두사 = 클라이언트, 없으면 서버 전용 |

### 8.2 Environment Variables

| Variable | Purpose | Scope |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 | Server |
| `NEXT_PUBLIC_KAKAO_API_KEY` | 카카오 JS SDK 키 | Client |
| `KAKAO_CLIENT_SECRET` | 카카오 OAuth 시크릿 | Server |
| `TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 | Client |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 | Server |
| `OPENAI_API_KEY` | AI 배경 생성 | Server |
| `NEXT_PUBLIC_APP_URL` | 앱 기본 URL (공유 링크) | Client |

---

## 9. Screen Flow Summary

> 이미지 `startImg/` 기준 화면 번호 매핑

| 번호 | 화면명 | 설명 |
|------|--------|------|
| 100 | 홈 | "마음의 말을 담아 전달합니다" + 카드 만들기 CTA + 최근 카드 |
| 200 | 목적 선택 | 생일/감사/사랑/응원/위로/축하 등 카테고리 선택 |
| 300 | 글귀 입력 | 직접 입력 or 추천 글귀 선택 |
| 400 | 이미지 선택 | 배경 라이브러리 or AI 생성 진입 |
| 500 | 배경 선택 | 큐레이팅된 배경 이미지 그리드 |
| 600 | AI 배경 생성 | 키워드 입력 → 프로그레스(75%) → 결과 |
| 700 | 카드 미리보기 | 완성 카드 확인 + 다운로드/공유 버튼 |
| 800 | 소셜 공유 | 카카오톡 / 인스타그램 / URL 복사 |
| 900 | 기념일 관리 | 달력 뷰 + 기념일 등록/수정 |

---

## 10. Next Steps

1. [ ] `/pdca design maumcard-mvp` — 상세 설계 문서 작성
2. [ ] Supabase 프로젝트 생성 및 DB 스키마 설계
3. [ ] Next.js 프로젝트 초기화 (`create-next-app`)
4. [ ] 카카오 개발자 센터 앱 등록
5. [ ] 토스페이먼츠 테스트 계정 생성

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-14 | Initial draft (startImg 기반 기획) | dkpark55@gmail.com |
