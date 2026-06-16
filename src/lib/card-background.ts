// 카드 배경 로딩 공용 모듈. card-image 라우트와 whitespace 라우트가 공유한다.
import sharp from "sharp";
import { CARD_WIDTH, CARD_HEIGHT } from "@/lib/card-text-render";

export const gradientMap: Record<string, { from: string; via: string; to: string; accent: string }> = {
  flower: { from: "#ffe4e6", via: "#fff7ed", to: "#fce7f3", accent: "#f4a6b8" },
  mountain: { from: "#e0f2fe", via: "#d1fae5", to: "#ecfccb", accent: "#7bbf9e" },
  river: { from: "#cffafe", via: "#eff6ff", to: "#d1fae5", accent: "#6ab7d6" },
  sunset: { from: "#fed7aa", via: "#fef3c7", to: "#ede9fe", accent: "#e59b63" },
  sea: { from: "#e0f2fe", via: "#cffafe", to: "#bfdbfe", accent: "#5ba8d6" },
  hanok: { from: "#f5f5f4", via: "#fff7ed", to: "#ffe4e6", accent: "#b9824b" },
  spring: { from: "#ecfccb", via: "#f0f9ff", to: "#ffe4e6", accent: "#9fca72" },
  autumn: { from: "#fef9c3", via: "#ffedd5", to: "#fee2e2", accent: "#d98238" },
  winter: { from: "#f1f5f9", via: "#f0f9ff", to: "#dbeafe", accent: "#8fb6df" },
};

// bg 키별 강조색. AI/외부 배경은 기본 따뜻한 톤.
export function resolveAccent(bg: string): string {
  return gradientMap[bg]?.accent ?? "#a8643c";
}

export function buildFallbackBackground(bg: string): Buffer {
  const c = gradientMap[bg] ?? gradientMap.flower;
  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c.from}"/>
          <stop offset="52%" stop-color="${c.via}"/>
          <stop offset="100%" stop-color="${c.to}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="55%" r="44%">
          <stop offset="0%" stop-color="#fffaf0" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#fffaf0" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#glow)"/>
    </svg>
  `);
}

export async function loadBackground(bg: string): Promise<Buffer> {
  const url = bg.startsWith("ai:")
    ? bg.slice(3)
    : bg.startsWith("http://") || bg.startsWith("https://") || bg.startsWith("data:")
      ? bg
      : "";

  if (!url) return sharp(buildFallbackBackground(bg)).png().toBuffer();
  if (url.startsWith("data:image/")) {
    const [, encoded] = url.split(",", 2);
    return Buffer.from(encoded, "base64");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("background fetch failed");
  return Buffer.from(await res.arrayBuffer());
}
