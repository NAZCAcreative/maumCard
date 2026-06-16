import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-4">💞</div>
      <h1 className="text-2xl font-black text-[#5a240d] mb-2">페이지를 찾을 수 없어요</h1>
      <p className="text-stone-500 font-semibold mb-8">요청하신 페이지가 존재하지 않습니다.</p>
      <Link
        href="/"
        className="h-12 px-8 flex items-center rounded-md bg-[#7b310d] font-bold text-white"
      >
        홈으로 돌아가기
      </Link>
    </main>
  );
}
