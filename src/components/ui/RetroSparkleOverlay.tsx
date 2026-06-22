"use client";

import { useEffect, useRef } from "react";
import { drawRetroEffects, makeSparkles, type GifEffectId } from "@/lib/retro-effect";

/**
 * 카드 위에 얹어 레트로 반짝이 효과를 실시간으로 애니메이션하는 투명 오버레이.
 * 부모는 position: relative 여야 하며, 이 캔버스는 absolute inset-0 으로 덮는다.
 */
export function RetroSparkleOverlay({
  effect = "sparkle",
  loopMs = 2600,
}: {
  effect?: GifEffectId;
  loopMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sparkles = makeSparkles(26);
    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const tick = (now: number) => {
      const progress = ((now - start) % loopMs) / loopMs;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRetroEffects(ctx, canvas.width, canvas.height, progress, sparkles, effect);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [loopMs, effect]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
