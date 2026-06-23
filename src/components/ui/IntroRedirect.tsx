"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { shouldShowOnboarding } from "@/lib/onboarding";

const SESSION_GUARD = "maumcard:intro-redirected";

/**
 * 홈 진입 시 프리뷰(/intro) 페이지로 보낸다.
 * 세션당 1회만 보내 무한 루프(홈↔인트로)를 방지한다.
 */
export function IntroRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_GUARD)) return;
    } catch {
      /* ignore */
    }
    if (shouldShowOnboarding()) {
      try {
        sessionStorage.setItem(SESSION_GUARD, "1");
      } catch {
        /* ignore */
      }
      router.replace("/intro");
    }
  }, [router]);

  return null;
}
