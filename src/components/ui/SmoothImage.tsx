"use client";

import { useState, type ImgHTMLAttributes } from "react";

/**
 * 로드 완료 전까지 투명, 완료 시 부드럽게 페이드인하는 이미지.
 * 카드 썸네일/배경 등 네트워크 이미지의 "툭 나타나는" 깜빡임을 제거한다.
 * - 캐시되어 이미 complete 상태인 이미지는 ref 콜백에서 즉시 표시(투명 고착 방지).
 * - onLoad/onError 모두에서 표시 처리하여 깨진 이미지도 숨김 상태로 남지 않게 한다.
 */
export function SmoothImage({
  className = "",
  style,
  onLoad,
  onError,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ""}
      ref={(node) => {
        if (node?.complete) setLoaded(true);
      }}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
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
