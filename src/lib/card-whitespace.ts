// 빈 공간(여백) 탐지 — 엣지밀도(Laplacian) + 적분영상 + 영역 성장(region growing).
// 가장 빈 "씨앗"에서 시작해, 인접 영역이 느슨한 임계값 이하인 동안 사방으로 확장하여
// 실제 흰 영역 모양에 맞게 구체적으로 탐지한다.
import sharp from "sharp";

const AW = 96;
const AH = 144;

// 성장 임계값 마진(느슨함). 씨앗 밀도 + LOOSENESS 이하 영역까지 흡수. 클수록 느슨/넓게.
const LOOSENESS = 0.07;
// 과도 성장 방지 상한
const MAX_W_RATIO = 0.92;
const MAX_H_RATIO = 0.6;
// 성장 후 추가 확장(여유) — 셀 단위
const PAD_CELLS = 2;

export type WhitespaceRegion = {
  cx: number; cy: number;
  x0: number; y0: number; x1: number; y1: number;
  band: "top" | "center" | "bottom";
  density: number;   // 평균 엣지밀도 0~1 (낮을수록 비어있음)
  emptiness: number; // 1 - density
  wRatio: number; hRatio: number;
};

async function edgeMap(srcBuf: Buffer): Promise<Buffer> {
  const { data } = await sharp(srcBuf)
    .resize(AW, AH, { fit: "cover", position: "centre" })
    .grayscale()
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
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

// 사각형 [x0,x1)×[y0,y1) 평균 엣지밀도 0~1
function rectAvg(I: Float64Array, x0: number, y0: number, x1: number, y1: number): number {
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return 1;
  const W1 = AW + 1;
  const sum = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  return sum / (w * h) / 255;
}

/**
 * 빈 영역을 영역 성장으로 구체적으로 탐지한다.
 * @param opts.looseness 성장 임계 마진(기본 0.07). 클수록 더 느슨/넓게 확장.
 */
export async function detectWhitespace(
  srcBuf: Buffer,
  opts?: { looseness?: number },
): Promise<WhitespaceRegion> {
  const looseness = opts?.looseness ?? LOOSENESS;
  const map = await edgeMap(srcBuf);
  const I = integralImage(map, AW, AH);

  // 1) 씨앗: 작은 윈도우로 가장 비어있는 핵심 영역 탐색
  const sw = Math.max(4, Math.round(AW * 0.28));
  const sh = Math.max(4, Math.round(AH * 0.1));
  let seed = { x: 0, y: 0, d: Infinity };
  for (let y = 0; y + sh <= AH; y += 1) {
    for (let x = 0; x + sw <= AW; x += 1) {
      const d = rectAvg(I, x, y, x + sw, y + sh);
      if (d < seed.d) seed = { x, y, d };
    }
  }

  const T = Math.min(0.45, seed.d + looseness);
  const maxW = Math.round(AW * MAX_W_RATIO);
  const maxH = Math.round(AH * MAX_H_RATIO);
  const STEP = 2;

  let bx0 = seed.x, by0 = seed.y, bx1 = seed.x + sw, by1 = seed.y + sh;

  // 2) 영역 성장: 인접 스트립이 임계값 이하면 흡수 (사방 반복)
  let grew = true;
  while (grew) {
    grew = false;
    if (by0 - STEP >= 0 && by1 - by0 + STEP <= maxH && rectAvg(I, bx0, by0 - STEP, bx1, by0) <= T) {
      by0 -= STEP; grew = true;
    }
    if (by1 + STEP <= AH && by1 - by0 + STEP <= maxH && rectAvg(I, bx0, by1, bx1, by1 + STEP) <= T) {
      by1 += STEP; grew = true;
    }
    if (bx0 - STEP >= 0 && bx1 - bx0 + STEP <= maxW && rectAvg(I, bx0 - STEP, by0, bx0, by1) <= T) {
      bx0 -= STEP; grew = true;
    }
    if (bx1 + STEP <= AW && bx1 - bx0 + STEP <= maxW && rectAvg(I, bx1, by0, bx1 + STEP, by1) <= T) {
      bx1 += STEP; grew = true;
    }
  }

  // 3) 여유 확장(조금 더 포함)
  bx0 = Math.max(0, bx0 - PAD_CELLS);
  by0 = Math.max(0, by0 - PAD_CELLS);
  bx1 = Math.min(AW, bx1 + PAD_CELLS);
  by1 = Math.min(AH, by1 + PAD_CELLS);

  const density = rectAvg(I, bx0, by0, bx1, by1);
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
    wRatio: (bx1 - bx0) / AW,
    hRatio: (by1 - by0) / AH,
  };
}
