// 빈 공간(여백) 탐지 — 엣지밀도(Laplacian) + 밝기(휘도) + 적분영상 + 영역 성장(region growing).
// "매끈하면서(엣지 적고) 밝은" 영역을 비용 함수로 평가해, 가장 좋은 씨앗에서
// 인접 영역이 임계값 이하인 동안 사방으로 확장하여 밝고 넓은 흰 영역을 탐지한다.
import sharp from "sharp";

const AW = 96;
const AH = 144;

// 성장 임계값 마진(느슨함). 씨앗 비용 + LOOSENESS 이하 영역까지 흡수. 클수록 느슨/넓게.
const LOOSENESS = 0.07;
// 비용에서 밝기가 차지하는 비중. 클수록 어두운 영역을 더 강하게 회피(밝은 영역 선호).
const DARK_WEIGHT = 0.18;
// 너무 어두운 영역은 매끈해도 후보에서 배제(텍스트 가독성). 평균 휘도가 이 값 미만이면 큰 페널티.
const MIN_BRIGHTNESS = 0.42;
const DARK_PENALTY = 0.5;
// 과도 성장 방지 상한
const MAX_W_RATIO = 0.92;
const MAX_H_RATIO = 0.6;
// 탐지영역이 이보다 작으면 "평균 크기 중앙 배치"로 폴백
const MIN_USABLE_W_RATIO = 0.4;
const MIN_USABLE_H_RATIO = 0.16;
// 폴백 평균 크기(중앙 배치)
const AVG_W_RATIO = 0.72;
const AVG_H_RATIO = 0.42;
// 성장 후 추가 확장(여유) — 셀 단위
const PAD_CELLS = 2;

export type WhitespaceRegion = {
  cx: number; cy: number;
  x0: number; y0: number; x1: number; y1: number;
  band: "top" | "center" | "bottom";
  density: number;    // 평균 엣지밀도 0~1 (낮을수록 비어있음)
  emptiness: number;  // 1 - density
  brightness: number; // 평균 휘도 0~1 (높을수록 밝음)
  wRatio: number; hRatio: number;
};

// 엣지맵(라플라시안)과 휘도맵을 함께 만든다 (둘 다 AW×AH raw 그레이스케일).
async function buildMaps(srcBuf: Buffer): Promise<{ edge: Buffer; bright: Buffer }> {
  const base = sharp(srcBuf).resize(AW, AH, { fit: "cover", position: "centre" }).grayscale();
  const [edge, bright] = await Promise.all([
    base
      .clone()
      .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
      .raw()
      .toBuffer(),
    base.clone().raw().toBuffer(),
  ]);
  return { edge, bright };
}

function integralImage(map: Buffer, w: number, h: number): Float64Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += map[(y - 1) * w + (x - 1)];
      I[y * (w + 1) + x] = I[(y - 1) * (w + 1) + x] + rowSum;
    }
  }
  return I;
}

// 사각형 [x0,x1)×[y0,y1) 평균값 0~1
function rectAvg(I: Float64Array, x0: number, y0: number, x1: number, y1: number): number {
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return 1;
  const W1 = AW + 1;
  const sum = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  return sum / (w * h) / 255;
}

// 비용: 엣지가 많을수록 + 어두울수록 높다. (낮을수록 텍스트 놓기 좋은 곳)
function rectCost(
  Ie: Float64Array,
  Ib: Float64Array,
  x0: number, y0: number, x1: number, y1: number,
): number {
  const edge = rectAvg(Ie, x0, y0, x1, y1);
  const bright = rectAvg(Ib, x0, y0, x1, y1);
  let cost = edge + DARK_WEIGHT * (1 - bright);
  if (bright < MIN_BRIGHTNESS) cost += DARK_PENALTY * (MIN_BRIGHTNESS - bright);
  return cost;
}

/**
 * 밝고 넓은 빈 영역을 영역 성장으로 탐지한다.
 * @param opts.looseness 성장 임계 마진(기본 0.07). 클수록 더 느슨/넓게 확장.
 */
export async function detectWhitespace(
  srcBuf: Buffer,
  opts?: { looseness?: number },
): Promise<WhitespaceRegion> {
  const looseness = opts?.looseness ?? LOOSENESS;
  const { edge, bright } = await buildMaps(srcBuf);
  const Ie = integralImage(edge, AW, AH);
  const Ib = integralImage(bright, AW, AH);

  // 1) 씨앗: 가로로 넓은 작은 윈도우로 "매끈+밝은" 핵심 영역 탐색
  const sw = Math.max(4, Math.round(AW * 0.28));
  const sh = Math.max(4, Math.round(AH * 0.1));
  let seed = { x: 0, y: 0, c: Infinity };
  for (let y = 0; y + sh <= AH; y += 1) {
    for (let x = 0; x + sw <= AW; x += 1) {
      const c = rectCost(Ie, Ib, x, y, x + sw, y + sh);
      if (c < seed.c) seed = { x, y, c };
    }
  }

  const T = Math.min(0.5, seed.c + looseness);
  const maxW = Math.round(AW * MAX_W_RATIO);
  const maxH = Math.round(AH * MAX_H_RATIO);
  const STEP = 2;

  let bx0 = seed.x, by0 = seed.y, bx1 = seed.x + sw, by1 = seed.y + sh;

  // 2) 영역 성장: 인접 스트립의 비용이 임계값 이하면 흡수 (사방 반복).
  //    가로(넓게) 확장을 세로보다 먼저 시도해 넓은 띠를 우선 흡수.
  let grew = true;
  while (grew) {
    grew = false;
    if (bx0 - STEP >= 0 && bx1 - bx0 + STEP <= maxW && rectCost(Ie, Ib, bx0 - STEP, by0, bx0, by1) <= T) {
      bx0 -= STEP; grew = true;
    }
    if (bx1 + STEP <= AW && bx1 - bx0 + STEP <= maxW && rectCost(Ie, Ib, bx1, by0, bx1 + STEP, by1) <= T) {
      bx1 += STEP; grew = true;
    }
    if (by0 - STEP >= 0 && by1 - by0 + STEP <= maxH && rectCost(Ie, Ib, bx0, by0 - STEP, bx1, by0) <= T) {
      by0 -= STEP; grew = true;
    }
    if (by1 + STEP <= AH && by1 - by0 + STEP <= maxH && rectCost(Ie, Ib, bx0, by1, bx1, by1 + STEP) <= T) {
      by1 += STEP; grew = true;
    }
  }

  // 3) 여유 확장(조금 더 포함)
  bx0 = Math.max(0, bx0 - PAD_CELLS);
  by0 = Math.max(0, by0 - PAD_CELLS);
  bx1 = Math.min(AW, bx1 + PAD_CELLS);
  by1 = Math.min(AH, by1 + PAD_CELLS);

  // 4) 탐지영역이 너무 작으면(글씨 놓기 불충분) 평균 크기로 중앙 배치 폴백.
  if ((bx1 - bx0) / AW < MIN_USABLE_W_RATIO || (by1 - by0) / AH < MIN_USABLE_H_RATIO) {
    const avgW = Math.round(AW * AVG_W_RATIO);
    const avgH = Math.round(AH * AVG_H_RATIO);
    bx0 = Math.round((AW - avgW) / 2);
    by0 = Math.round((AH - avgH) / 2);
    bx1 = bx0 + avgW;
    by1 = by0 + avgH;
  }

  const density = rectAvg(Ie, bx0, by0, bx1, by1);
  const brightness = rectAvg(Ib, bx0, by0, bx1, by1);
  const cy = (by0 + by1) / 2 / AH;
  return {
    cx: (bx0 + bx1) / 2 / AW,
    cy,
    x0: bx0 / AW,
    y0: by0 / AH,
    x1: bx1 / AW,
    y1: by1 / AH,
    band: cy < 0.4 ? "top" : cy > 0.6 ? "bottom" : "center",
    density: Math.min(1, Math.max(0, density)),
    emptiness: 1 - Math.min(1, Math.max(0, density)),
    brightness: Math.min(1, Math.max(0, brightness)),
    wRatio: (bx1 - bx0) / AW,
    hRatio: (by1 - by0) / AH,
  };
}
