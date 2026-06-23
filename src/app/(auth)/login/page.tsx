"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { redirectToGoogleLogin, sendEmailLoginLink } from "@/lib/auth";
import { InAppBrowserNotice } from "@/components/ui/InAppBrowserNotice";

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? `로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.${
          searchParams.get("reason") ? `\n(사유: ${searchParams.get("reason")})` : ""
        }`
      : null,
  );
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading("google");
    setError(null);
    try {
      await redirectToGoogleLogin();
    } catch {
      setLoading(null);
      setError("Google 로그인을 시작하지 못했습니다. Supabase Google provider 설정을 확인해 주세요.");
    }
  };

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    setLoading("email");
    setError(null);
    setSent(false);
    try {
      await sendEmailLoginLink(trimmed);
      setSent(true);
    } catch {
      setError("로그인 링크를 보내지 못했습니다. 이메일 설정을 확인해 주세요.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6">
      <div className="mb-10 text-center">
        <div className="mb-4 text-6xl">💌</div>
        <h1 className="text-3xl font-black text-[#5a240d]">마음카드</h1>
        <p className="mt-2 font-semibold text-stone-600">마음을 담아 전하는 나만의 카드</p>
      </div>

      <div className="w-full space-y-4">
        <InAppBrowserNotice />
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading !== null}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-stone-200 bg-white font-bold text-stone-800 shadow-sm disabled:opacity-60"
        >
          <span className="grid size-6 place-items-center rounded-full border border-stone-200 text-sm font-black text-blue-600">
            G
          </span>
          {loading === "google" ? "Google 로그인 연결 중..." : "Google로 시작하기"}
        </button>

        <div className="flex items-center gap-3 text-xs font-semibold text-stone-400">
          <div className="h-px flex-1 bg-stone-100" />
          <span>또는</span>
          <div className="h-px flex-1 bg-stone-100" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 주소"
            className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="h-12 w-full rounded-md border border-[#9a4a22] bg-white font-bold text-[#7b310d] disabled:opacity-60"
          >
            {loading === "email" ? "로그인 링크 보내는 중..." : "이메일로 로그인 링크 받기"}
          </button>
        </form>

        {sent && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-center text-sm font-semibold text-green-700">
            이메일로 로그인 링크를 보냈습니다.
          </p>
        )}
        {error && (
          <p className="whitespace-pre-line rounded-md bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <p className="text-center text-xs text-stone-400">
          로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
