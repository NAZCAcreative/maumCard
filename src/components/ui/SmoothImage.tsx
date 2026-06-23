"use client";

import { useState, type ImgHTMLAttributes } from "react";

type SmoothImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** 로드 실패 시 자동 재시도 횟수. (방금 업로드한 파일의 CDN 전파 지연 대응) */
  retryCount?: number;
  /** 재시도 간격(ms). 시도가 늘수록 점증한다. */
  retryDelayMs?: number;
};

/**
 * 로드 완료 전까지 투명, 완료 시 부드럽게 페이드인하는 이미지.
 * 카드 썸네일/배경 등 네트워크 이미지의 "툭 나타나는" 깜빡임을 제거한다.
 * - 캐시되어 이미 complete 상태인 이미지는 ref 콜백에서 즉시 표시(투명 고착 방지).
 * - retryCount 지정 시: 로드 실패하면 캐시버스터를 붙여 점증 지연 후 재시도(CDN 전파 지연 대응).
 */
export function SmoothImage({
  className = "",
  style,
  onLoad,
  onError,
  src,
  retryCount = 0,
  retryDelayMs = 700,
  ...props
}: SmoothImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const resolvedSrc =
    attempt === 0 || !src
      ? src
      : `${src}${String(src).includes("?") ? "&" : "?"}_r=${attempt}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={resolvedSrc}
      alt={props.alt ?? ""}
      ref={(node) => {
        if (node?.complete && node.naturalWidth > 0) setLoaded(true);
      }}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        if (attempt < retryCount) {
          const next = attempt + 1;
          window.setTimeout(() => setAttempt(next), retryDelayMs * next);
          return;
        }
        setLoaded(true);
        onError?.(e);
      }}
      className={className}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.45s ease",
      }}
    />
  );
}
