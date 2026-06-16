"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PLANS } from "@/lib/toss";

type Status = "verifying" | "success" | "error";

function VerifyingView() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-6xl">⏳</div>
      <h1 className="text-2xl font-black text-[#5a240d]">결제 확인 중...</h1>
      <p className="mt-2 font-semibold text-stone-500">잠시만 기다려 주세요.</p>
    </main>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const planId = searchParams.get("planId");

    if (!paymentKey || !orderId || !amount) {
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      setStatus("error");
      return;
    }

    const plan = PLANS.find((p) => p.id === planId);

    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), planId }),
    })
      .then((res) => res.json())
      .then((data: { error?: string; credits?: number }) => {
        if (data.error) {
          setErrorMsg(data.error);
          setStatus("error");
        } else {
          setCreditsAdded(data.credits ?? plan?.credits ?? 0);
          setStatus("success");
          setTimeout(() => router.push("/mypage"), 3000);
        }
      })
      .catch(() => {
        setErrorMsg("결제 확인 중 오류가 발생했습니다.");
        setStatus("error");
      });
  }, [searchParams, router]);

  if (status === "verifying") return <VerifyingView />;

  if (status === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 text-6xl">!</div>
        <h1 className="text-2xl font-black text-[#5a240d]">결제 확인 실패</h1>
        <p className="mt-2 font-semibold text-red-600">{errorMsg}</p>
        <Link href="/mypage" className="mt-8 grid h-12 w-full place-items-center rounded-md bg-[#7b310d] font-bold text-white">
          마이페이지로
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-7xl">✓</div>
      <h1 className="text-2xl font-black text-[#5a240d]">결제 완료!</h1>
      <p className="mt-3 text-lg font-bold text-stone-700">
        크레딧 <span className="text-[#7b310d]">{creditsAdded}개</span>가 충전되었어요.
      </p>
      <p className="mt-2 text-sm font-semibold text-stone-500">잠시 후 마이페이지로 이동합니다.</p>
      <Link href="/mypage" className="mt-8 grid h-12 w-full place-items-center rounded-md bg-[#7b310d] font-bold text-white">
        지금 이동
      </Link>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<VerifyingView />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
