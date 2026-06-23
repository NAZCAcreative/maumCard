// 온보딩(프리뷰) 노출 정책 공용 모듈.
export const ONBOARDING_KEY = "maumcard:onboarded:v2";
// ⚠️ 출시 전 false 로 변경 → 그때부터 "첫 진입 1회만" 노출. 현재 true: 테스트 편의상 매번.
export const ONBOARDING_ALWAYS = true;

export function shouldShowOnboarding(): boolean {
  if (ONBOARDING_ALWAYS) return true;
  try {
    return !window.localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* ignore */
  }
}
