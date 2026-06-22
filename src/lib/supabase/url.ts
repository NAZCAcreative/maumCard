// Supabase Project URL 정규화.
// 대시보드에서 Project URL 대신 Data API/REST URL("https://xxx.supabase.co/rest/v1")을
// 복사하거나 끝에 슬래시가 붙는 흔한 실수를 자동 교정한다.
// (이게 없으면 auth/storage 요청 경로가 ".../rest/v1/auth/v1/..." 처럼 깨져 401 발생)
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  // Supabase API(auth/rest/storage)는 항상 도메인 루트 기준이므로 origin 만 사용.
  // 값에 /rest/v1, /auth/v1/authorize 같은 경로가 붙어 있어도 안전하게 제거된다.
  try {
    return new URL(trimmed).origin;
  } catch {
    // 파싱 실패 시 보수적 폴백: 끝 슬래시 + 알려진 API 경로 제거
    return trimmed.replace(/\/+$/, "").replace(/\/(rest|auth|storage)\/v1.*$/, "").replace(/\/+$/, "");
  }
}
