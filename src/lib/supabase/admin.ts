import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

// Service role client — bypasses RLS. Server-side only.
// 모듈 로드 시점이 아니라 "첫 사용 시점"에 생성한다.
// (빌드 타임 page-data 수집 때 env 없이 import 되어도 터지지 않도록 지연 초기화)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): SupabaseClient<any> {
  if (!cached) {
    const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase admin 클라이언트에는 NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다."
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cached = createClient<any>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

// 기존 호출부(supabaseAdmin.from(...), supabaseAdmin.storage...)를 그대로 유지하기 위한 지연 프록시.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = new Proxy({} as SupabaseClient<any>, {
  get(_target, prop) {
    const client = getAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
