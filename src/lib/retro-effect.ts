// 레트로 "반짝이" 효과 프레임 렌더러.
// 온스크린 미리보기(RetroSparkleOverlay)와 GIF 생성(retro-gif)이
// 동일한 그림을 그리도록 공용으로 사용한다. progress 는 0..1 루프.

export type Sparkle = {
  x: number; // 0..1 비율
  y: number; // 0..1 비율
  size: number; // px (기준 폭 대비)
  phase: number; // 트윙클 위상
  speed: number; // 트윙클 속도 배수
  hue: number; // 색상(레트로 팔레트)
};

export type GifEffectId =
  | "sparkle"
  | "heart"
  | "snow"
  | "confetti"
  | "bubble"
  | "star"
  | "petal"
  | "neon"
  | "disco"
  | "shooting"
  | "bokeh"
  | "aurora"
  | "firefly"
  | "goldDust"
  | "lightray";

export const GIF_EFFECTS: Array<{ id: GifEffectId; label: string; emoji: string }> = [
  { id: "sparkle", label: "반짝이", emoji: "✨" },
  { id: "heart", label: "하트", emoji: "💗" },
  { id: "snow", label: "눈꽃", emoji: "❄️" },
  { id: "confetti", label: "축하", emoji: "🎉" },
  { id: "bubble", label: "비눗방울", emoji: "🫧" },
  { id: "star", label: "별빛", emoji: "⭐" },
  { id: "petal", label: "꽃잎", emoji: "🌸" },
  { id: "neon", label: "네온", emoji: "🌈" },
  { id: "disco", label: "디스코", emoji: "🪩" },
  { id: "shooting", label: "유성", emoji: "🌠" },
  { id: "bokeh", label: "보케", emoji: "💫" },
  { id: "aurora", label: "오로라", emoji: "🌌" },
  { id: "firefly", label: "반딧불", emoji: "💡" },
  { id: "goldDust", label: "금가루", emoji: "🌟" },
  { id: "lightray", label: "빛내림", emoji: "🔆" },
];

// 결정적 난수(seed) — 미리보기와 GIF가 같은 별 배치를 갖도록.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RETRO_HUES = [0, 48, 320, 190, 270]; // 화이트핑크/골드/핫핑크/시안/퍼플

export function makeSparkles(count: number, seed = 1234): Sparkle[] {
  const rnd = mulberry32(seed);
  const list: Sparkle[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: rnd(),
      y: rnd(),
      size: 6 + rnd() * 16,
      phase: rnd() * Math.PI * 2,
      speed: 1 + Math.floor(rnd() * 3), // 1~3 루프
      hue: RETRO_HUES[Math.floor(rnd() * RETRO_HUES.length)],
    });
  }
  return list;
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 1.4;
  // 4각 반짝이 별(오목한 마름모 4방향)
  const r2 = r * 0.32;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    const mx = Math.cos(a + Math.PI / 4) * r2;
    const my = Math.sin(a + Math.PI / 4) * r2;
    if (i === 0) ctx.moveTo(ax * r, ay * r);
    else ctx.lineTo(ax * r, ay * r);
    ctx.lineTo(mx, my);
  }
  ctx.closePath();
  ctx.fill();
  // 중심 글로우 점
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.restore();
}

/**
 * 한 프레임을 캔버스에 그린다.
 * - 카드 이미지(cover)
 * - 대각선 광택 스윕(글씨 포함 전체가 반짝이는 레트로 질감)
 * - 트윙클하는 반짝이 별
 * - 은은한 테두리 글로우 펄스
 */
export function drawRetroFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  progress: number,
  sparkles: Sparkle[],
  effect: GifEffectId = "sparkle",
) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(img, 0, 0, w, h);
  drawRetroEffects(ctx, w, h, progress, sparkles, effect);
}

/**
 * 반짝이/광택/글로우 효과만 그린다(베이스 이미지 없음).
 * 온스크린 오버레이는 투명 캔버스에 이것만 그려 카드 위에 합성한다.
 * 호출 전 caller 가 clearRect 로 비워야 한다.
 */
export function drawRetroEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  sparkles: Sparkle[],
  effect: GifEffectId = "sparkle",
) {
  const t = progress * Math.PI * 2;
  const scale = w / 360;

  if (effect === "sparkle") {
    const bandW = w * 0.5;
    const cx = -bandW + progress * (w + bandW * 2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, 0);
    ctx.rotate(0.32);
    const grad = ctx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.30)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-bandW / 2, -h, bandW, h * 3);
    ctx.restore();
    for (const s of sparkles) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      if (tw >= 0.04) {
        drawSparkle(ctx, s.x * w, s.y * h, s.size * (0.45 + tw * 0.9) * scale, `hsl(${s.hue} 100% 75%)`, tw);
      }
    }
  }

  if (effect === "heart") {
    for (const [i, s] of sparkles.slice(0, 20).entries()) {
      const y = ((s.y + 1 - progress * (0.35 + s.speed * 0.08)) % 1) * h;
      const size = s.size * scale * (0.7 + 0.18 * Math.sin(t + s.phase));
      const x = s.x * w + Math.sin(t * s.speed + s.phase) * 10 * scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t + s.phase) * 0.2);
      ctx.scale(size / 18, size / 18);
      ctx.fillStyle = `hsla(${330 + (i % 3) * 12} 95% 68% / 0.82)`;
      ctx.shadowColor = "#ff4f9a";
      ctx.shadowBlur = 7 * scale;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(-14, -5, -9, -17, 0, -9);
      ctx.bezierCurveTo(9, -17, 14, -5, 0, 5);
      ctx.fill();
      ctx.restore();
    }
  }

  if (effect === "snow") {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.shadowColor = "#b9e8ff";
    ctx.shadowBlur = 6 * scale;
    for (const s of sparkles) {
      const y = ((s.y + progress * (0.25 + s.speed * 0.09)) % 1) * h;
      const x = s.x * w + Math.sin(t + s.phase) * 9 * scale;
      const r = Math.max(1.5, s.size * 0.18 * scale);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (effect === "confetti") {
    const colors = ["#ff3b6b", "#ffd43b", "#35d07f", "#40a9ff", "#a66cff"];
    for (const [i, s] of sparkles.entries()) {
      const y = ((s.y + progress * (0.5 + s.speed * 0.1)) % 1) * h;
      ctx.save();
      ctx.translate(s.x * w + Math.sin(t + s.phase) * 8 * scale, y);
      ctx.rotate(t * s.speed + s.phase);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-2 * scale, -6 * scale, 4 * scale, 12 * scale);
      ctx.restore();
    }
  }

  if (effect === "bubble") {
    for (const s of sparkles.slice(0, 18)) {
      const y = ((s.y + 1 - progress * (0.18 + s.speed * 0.05)) % 1) * h;
      const r = s.size * 0.65 * scale;
      const x = s.x * w + Math.sin(t + s.phase) * 12 * scale;
      const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,.8)");
      grad.addColorStop(0.25, "rgba(255,180,230,.18)");
      grad.addColorStop(0.7, "rgba(80,220,255,.12)");
      grad.addColorStop(1, "rgba(255,255,255,.55)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (effect === "star") {
    for (const s of sparkles.slice(0, 22)) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase));
      const outer = s.size * tw * scale;
      const x = s.x * w;
      const y = s.y * h;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.15 + s.phase);
      ctx.fillStyle = `rgba(255,224,90,${tw})`;
      ctx.shadowColor = "#fff4a8";
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? outer : outer * 0.42;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (effect === "petal") {
    for (const [i, s] of sparkles.slice(0, 24).entries()) {
      const y = ((s.y + progress * (0.22 + s.speed * 0.06)) % 1) * h;
      const x = s.x * w + Math.sin(t * s.speed + s.phase) * 18 * scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * s.speed * 0.35 + s.phase);
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,255,255,.88)" : "rgba(255,150,190,.82)";
      ctx.beginPath();
      ctx.ellipse(0, 0, s.size * 0.3 * scale, s.size * 0.65 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (effect === "neon") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 5 * scale;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `hsla(${(progress * 360 + i * 120) % 360} 100% 65% / .65)`;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 16 * scale;
      const inset = (8 + i * 8) * scale;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    }
    ctx.restore();
  }

  if (effect === "disco") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beams = 8;
    for (let i = 0; i < beams; i++) {
      const angle = t * 0.35 + (i * Math.PI * 2) / beams;
      ctx.fillStyle = `hsla(${i * 45 + progress * 360} 100% 65% / .13)`;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.18);
      ctx.arc(w / 2, h * 0.18, h, angle, angle + 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  if (effect === "shooting") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [i, s] of sparkles.slice(0, 9).entries()) {
      const p = (progress * (0.8 + s.speed * 0.15) + s.x) % 1;
      const x = -w * 0.2 + p * w * 1.4;
      const y = (s.y * 0.75 + p * 0.2) * h;
      const grad = ctx.createLinearGradient(x - 70 * scale, y - 40 * scale, x, y);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, i % 2 ? "#aee7ff" : "#fff4b0");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5 * scale;
      ctx.beginPath();
      ctx.moveTo(x - 70 * scale, y - 40 * scale);
      ctx.lineTo(x, y);
      ctx.stroke();
      drawSparkle(ctx, x, y, 5 * scale, "#fff", 1);
    }
    ctx.restore();
  }

  if (effect === "bokeh") {
    // 은은한 보케 — 초점 흐린 빛망울이 천천히 떠오른다.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const hues = [40, 200, 320, 160];
    for (const [i, s] of sparkles.slice(0, 16).entries()) {
      const y = ((s.y + 1 - progress * (0.1 + s.speed * 0.04)) % 1) * h;
      const x = s.x * w + Math.sin(t * 0.5 + s.phase) * 14 * scale;
      const r = s.size * 1.7 * scale * (0.6 + 0.4 * Math.sin(t + s.phase));
      const hue = hues[i % hues.length];
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `hsla(${hue} 90% 82% / 0.45)`);
      grad.addColorStop(0.55, `hsla(${hue} 90% 78% / 0.14)`);
      grad.addColorStop(1, `hsla(${hue} 90% 78% / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (effect === "aurora") {
    // 오로라 — 물결치는 컬러 빛 띠.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const hues = [150, 190, 280];
    for (let b = 0; b < hues.length; b++) {
      const baseY = h * (0.24 + b * 0.2);
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 26) {
        const y = baseY + Math.sin((x / w) * Math.PI * 2 + t + b) * h * 0.06 + Math.sin(t * 0.7 + b) * h * 0.03;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, baseY - h * 0.12, 0, baseY + h * 0.12);
      grad.addColorStop(0, `hsla(${hues[b]} 90% 70% / 0)`);
      grad.addColorStop(0.5, `hsla(${hues[b]} 90% 70% / 0.22)`);
      grad.addColorStop(1, `hsla(${hues[b]} 90% 70% / 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = h * 0.15;
      ctx.stroke();
    }
    ctx.restore();
  }

  if (effect === "firefly") {
    // 반딧불 — 노란-연두 빛이 부드럽게 떠다니며 깜빡인다.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of sparkles) {
      const drift = t * 0.3 * s.speed;
      const x = (s.x + Math.sin(drift + s.phase) * 0.06) * w;
      const y = (s.y + Math.cos(drift * 0.8 + s.phase) * 0.06) * h;
      const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (1 + s.speed) + s.phase), 2);
      if (tw < 0.04) continue;
      const r = s.size * 0.42 * scale;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      grad.addColorStop(0, `rgba(220,255,150,${0.9 * tw})`);
      grad.addColorStop(1, "rgba(180,255,120,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (effect === "goldDust") {
    // 금가루 — 반짝이며 흩날리는 금빛 입자.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of sparkles) {
      const y = ((s.y + progress * (0.18 + s.speed * 0.06)) % 1) * h;
      const x = s.x * w + Math.sin(t * 1.2 + s.phase) * 10 * scale;
      const tw = 0.4 + 0.6 * Math.sin(t * 2 * s.speed + s.phase);
      if (tw < 0.06) continue;
      const r = Math.max(0.8, s.size * 0.15 * scale * (0.6 + tw));
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      halo.addColorStop(0, `rgba(255,225,120,${tw})`);
      halo.addColorStop(1, "rgba(255,200,80,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,250,220,${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (effect === "lightray") {
    // 빛내림 — 위에서 부드럽게 퍼지는 빛 기둥(god ray).
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const originX = w * (0.5 + 0.12 * Math.sin(t * 0.4));
    const beams = 6;
    for (let i = 0; i < beams; i++) {
      const sway = Math.sin(t * 0.5 + i * 0.9) * 0.05;
      const a = (i / (beams - 1) - 0.5) * 0.7 + sway;
      ctx.save();
      ctx.translate(originX, -h * 0.1);
      ctx.rotate(a);
      const bw = w * 0.07;
      const grad = ctx.createLinearGradient(0, 0, 0, h * 1.4);
      grad.addColorStop(0, "rgba(255,250,225,0.28)");
      grad.addColorStop(1, "rgba(255,250,225,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-bw / 2, 0, bw, h * 1.4);
      ctx.restore();
    }
    ctx.restore();
  }

  const pulse = 0.5 + 0.5 * Math.sin(t);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeStyle = effect === "heart"
    ? `rgba(255,100,160,${0.12 + pulse * 0.2})`
    : `rgba(255,230,180,${0.08 + pulse * 0.14})`;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}
