import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

  // OAuth 공급자(구글/Supabase)가 코드 대신 에러를 돌려준 경우도 잡는다.
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  const supabase = await createClient();
  let authError: unknown = providerError ? new Error(providerError) : null;

  if (!authError && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (!authError && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
  } else if (!authError && !code && !tokenHash) {
    authError = new Error("인증 코드가 전달되지 않았습니다 (code/token_hash 없음)");
  }

  if ((code || tokenHash) && !authError) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // 실제 실패 사유를 로그인 페이지로 넘겨 화면에서 확인 가능하게 한다.
  const reason =
    authError instanceof Error
      ? authError.message
      : typeof authError === "object" && authError && "message" in authError
        ? String((authError as { message: unknown }).message)
        : "unknown";
  console.error("Supabase auth callback failed:", authError);

  const forwardedHost = request.headers.get("x-forwarded-host");
  const base =
    process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin;
  return NextResponse.redirect(
    `${base}/login?error=auth_callback&reason=${encodeURIComponent(reason)}`
  );
}
