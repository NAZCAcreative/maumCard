// Supabase Project URL 정규화.
// 대시보드에서 Project URL 대신 Data API/REST URL("https://xxx.supabase.co/rest/v1")을
// 복사하거나 끝에 슬래시가 붙는 흔한 실수를 자동 교정한다.
// (이게 없으면 auth/storage 요청 경로가 ".../rest/v1/auth/v1/..." 처럼 깨져 401 발생)
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  return url.replace(/\/rest\/v1$/, "").replace(/\/+$/, "");
}
