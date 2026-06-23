"use client";

import { useEffect, useRef, useState } from "react";

const SLIDES = [
  "/preview/onma_pre01.PNG",
  "/preview/onma_pre02.PNG",
  "/preview/onma_pre03.PNG",
];
const STORAGE_KEY = "maumcard:onboarded";

/**
 * 첫 진입 온보딩 — 미리보기 3장 좌우 스와이프, 마지막 장에서 "시작하기".
 * localStorage 플래그로 한 번만 노출한다.
 */
export function Onboarding() {
  const [show, setShow] = useState(false);
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
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

  if (!show) return null;

  const isLast = index >= SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      {/* 건너뛰기 */}
      <div className="flex justify-end px-4 py-2">
        <button
          type="button"
          onClick={finish}
          className="rounded-full px-3 py-1.5 text-sm font-bold text-stone-400 hover:text-stone-600"
        >
          건너뛰기
        </button>
      </div>

      {/* 슬라이드 (좌우 스와이프) */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      {/* 하단: 인디케이터 + 버튼 */}
      <div className="flex flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}번째 소개로 이동`}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-[#7b310d]" : "w-2 bg-stone-300"}`}
            />
          ))}
        </div>
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="h-14 w-full rounded-2xl bg-[#7b310d] text-base font-black text-white shadow-sm transition active:scale-[0.99]"
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
    </div>
  );
}
