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
  cosmic: { from: "#c3dafe", via: "#fbcfe8", to: "#fee2e2", accent: "#7c3aed" },
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

// 배경 사진 필터 — 미리보기/저장 카드에 동일하게 baked 된다.
export type BgFilter = "none" | "bright" | "insta" | "bw" | "vintage";

// 빈티지: 원본 픽셀은 그대로 두고 위에 비네팅 레이어만 씌운다.
// 안쪽(가운데)은 투명, 바깥쪽(가장자리)으로 갈수록 원형으로 약간 어두워지는 그라데이션.
function filmOverlaySvg(w: number, h: number): string {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vig" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#1a1206" stop-opacity="0"/>
        <stop offset="50%" stop-color="#1a1206" stop-opacity="0"/>
        <stop offset="100%" stop-color="#1a1206" stop-opacity="0.4"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#vig)"/>
  </svg>`;
}

// 필름 레이어 표준 크기. 카드 비율(3:4)에 맞춘 PNG 를 한 번만 만들어 재사용한다.
const FILM_OVERLAY_W = 1080;
const FILM_OVERLAY_H = 1440;

// feTurbulence 그레인 래스터화는 비싸므로, 필름 레이어 PNG 를 프로세스당 한 번만
// 만들어 캐시한다(미리 만들어두기). 이후엔 베이스 크기로 리사이즈만 해서 덧댄다.
let filmOverlayCache: Promise<Buffer> | null = null;
function getFilmOverlay(): Promise<Buffer> {
  if (!filmOverlayCache) {
    filmOverlayCache = sharp(Buffer.from(filmOverlaySvg(FILM_OVERLAY_W, FILM_OVERLAY_H)))
      .png()
      .toBuffer();
  }
  return filmOverlayCache;
}

// 필터를 sharp 파이프라인으로 적용. none 이면 원본 그대로.
export async function applyBgFilter(buf: Buffer, filter: BgFilter): Promise<Buffer> {
  if (filter === "none") return buf;

  // 빈티지는 이미지 변형 없이 필름 레이어만 합성.
  // 미리 만들어 캐시한 필름 PNG 를 베이스 크기로 리사이즈해 위에 덧댄다(빠름).
  if (filter === "vintage") {
    const base = sharp(buf);
    const meta = await base.metadata();
    const w = meta.width ?? FILM_OVERLAY_W;
    const h = meta.height ?? FILM_OVERLAY_H;
    const cached = await getFilmOverlay();
    const overlay = await sharp(cached).resize(w, h, { fit: "fill" }).png().toBuffer();
    return base.composite([{ input: overlay, blend: "over" }]).toBuffer();
  }

  let img = sharp(buf);
  switch (filter) {
    case "bright": // 밝게: 밝기/채도 살짝 올림
      img = img.modulate({ brightness: 1.16, saturation: 1.06 });
      break;
    case "insta": // 인스타: 대비·채도를 확실히 높인 쨍한 버전
      img = img
        .modulate({ brightness: 1.02, saturation: 1.55 })
        .linear(1.22, -0.22 * 128); // 중간톤 유지하며 대비 강화
      break;
    case "bw": // 흑백 + 약간의 대비
      img = img.grayscale().linear(1.12, -8);
      break;
  }
  return img.toBuffer();
}

export async function loadBackground(bg: string, filter: BgFilter = "none"): Promise<Buffer> {
  const url = bg.startsWith("ai:")
    ? bg.slice(3)
    : bg.startsWith("http://") || bg.startsWith("https://") || bg.startsWith("data:")
      ? bg
      : "";

  let base: Buffer;
  if (!url) {
    base = await sharp(buildFallbackBackground(bg)).png().toBuffer();
  } else if (url.startsWith("data:image/")) {
    const [, encoded] = url.split(",", 2);
    base = await sharp(Buffer.from(encoded, "base64")).rotate().toBuffer();
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error("background fetch failed");
    base = await sharp(Buffer.from(await res.arrayBuffer())).rotate().toBuffer();
  }
  return applyBgFilter(base, filter);
}
