"use client";

/**
 * (main) 그룹 라우트 전환 래퍼.
 * template.tsx 는 네비게이션마다 새 인스턴스로 마운트되므로,
 * 페이지 이동 시마다 진입 애니메이션이 안정적으로 재생된다.
 * 이미지 페이드인(SmoothImage)과 함께 "툭 끊기는" 전환 대신 매끄러운 전환을 만든다.
 */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-transition">{children}</div>;
}
