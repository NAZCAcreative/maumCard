"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markOnboarded } from "@/lib/onboarding";

const SLIDES = [
  "/preview/onma_pre01.PNG",
  "/preview/onma_pre02.PNG",
  "/preview/onma_pre03.PNG",
];

/** 프리뷰(온보딩) 독립 페이지 — 미리보기 3장 좌우 스와이프, 마지막 장에서 시작하기 → 홈. */
export default function IntroPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const finish = () => {
    markOnboarded();
    router.replace("/");
  };

  const scrollToIndex = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const isLast = index >= SLIDES.length - 1;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-surface">
      <div className="flex justify-end px-4 py-2">
        <button
          type="button"
          onClick={finish}
          className="rounded-full px-3 py-1.5 text-sm font-bold text-stone-400 hover:text-stone-600"
        >
          건너뛰기
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((src, i) => (
          <div key={src} className="flex w-full shrink-0 snap-center items-start justify-center px-5 pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`마음카드 소개 ${i + 1}`}
              className="max-h-full w-full rounded-2xl object-contain object-top"
              draggable={false}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 소개로 이동`}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-stone-300"}`}
            />
          ))}
        </div>
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="h-14 w-full rounded-2xl bg-primary text-base font-black text-white shadow-sm transition active:scale-[0.99]"
          >
            시작하기
          </button>
        ) : (
          <button
            type="button"
            onClick={() => scrollToIndex(index + 1)}
            className="h-14 w-full rounded-2xl border border-stone-200 text-base font-bold text-stone-700 transition active:scale-[0.99]"
          >
            다음
          </button>
        )}
      </div>
    </main>
  );
}
