import Link from "next/link";

export default function PaymentFailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-7xl">!</div>
      <h1 className="text-2xl font-black text-[#5a240d]">결제가 취소되었습니다</h1>
      <p className="mt-2 font-semibold text-stone-500">결제 도중 취소되었거나 오류가 발생했습니다.</p>
      <div className="mt-8 w-full space-y-3">
        <Link href="/mypage" className="grid h-12 w-full place-items-center rounded-md bg-[#7b310d] font-bold text-white">
          다시 시도
        </Link>
        <Link href="/" className="grid h-12 w-full place-items-center rounded-md border border-stone-200 font-semibold text-stone-700">
          홈으로
        </Link>
      </div>
    </main>
  );
}
