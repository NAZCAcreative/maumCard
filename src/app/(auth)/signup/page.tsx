import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-white px-6">
      <h1 className="text-center text-2xl font-black text-[#5a240d]">마음카드 회원가입</h1>
      <p className="mt-3 text-center text-sm font-semibold text-stone-600">
        Google 또는 이메일 로그인으로 바로 시작할 수 있어요.
      </p>
      <Link href="/login" className="mt-8 grid h-12 place-items-center rounded-md bg-[#7b310d] font-bold text-white">
        로그인하고 시작하기
      </Link>
    </main>
  );
}
