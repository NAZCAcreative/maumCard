import { createBrowserClient } from "@supabase/ssr";

// Supabase 프로젝트 연결 후 `npx supabase gen types typescript` 로 교체 예정
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
      },
    }
  );
}
