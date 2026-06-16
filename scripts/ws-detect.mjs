// 빈 공간(여백) 탐지 테스트 — 엣지밀도(Laplacian) + 적분영상 슬라이딩 윈도우.
// 텍스트 블록이 들어갈 가장 "비어있는" 사각 영역을 찾아 시각화한다.
//   node scripts/ws-detect.mjs <out-dir> <img1> [img2 ...]
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const CARD_W = 1024, CARD_H = 1536;
// 분석 해상도 (저해상도로 빠르게 분석). 2:3 유지.
const AW = 96, AH = 144;
// 텍스트 블록이 차지하는 비율 (가로 78%, 세로 34%)
const WIN_W = Math.round(AW * 0.78); // 75
const WIN_H = Math.round(AH * 0.34); // 49

async function loadToBuffer(src) {
  if (src.startsWith("http")) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${src} -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(src);
}

// 엣지밀도 맵: grayscale → Laplacian 컨볼루션 → AW*AH raw (0~255, 클수록 디테일 많음)
async function edgeMap(srcBuf) {
  const { data } = await sharp(srcBuf)
    .resize(AW, AH, { fit: "cover", position: "centre" })
    .grayscale()
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // data: AW*AH bytes (grayscale)
  return data;
}

// 적분영상(summed-area table)
function integralImage(map, w, h) {
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

function windowSum(I, w, x, y, ww, wh) {
  const W1 = w + 1;
  const a = I[y * W1 + x];
  const b = I[y * W1 + (x + ww)];
  const c = I[(y + wh) * W1 + x];
  const d = I[(y + wh) * W1 + (x + ww)];
  return d - b - c + a;
}

// 가장 비어있는(엣지합 최소) 윈도우 위치 탐색 → 중심 좌표(0~1 정규화) 반환
function findEmptiest(map, w, h, ww, wh) {
  const I = integralImage(map, w, h);
  let best = { x: 0, y: 0, score: Infinity };
  for (let y = 0; y + wh <= h; y++) {
    for (let x = 0; x + ww <= w; x++) {
      const s = windowSum(I, w, x, y, ww, wh);
      if (s < best.score) best = { x, y, score: s };
    }
  }
  return {
    cx: (best.x + ww / 2) / w,
    cy: (best.y + wh / 2) / h,
    x0: best.x / w, y0: best.y / h, x1: (best.x + ww) / w, y1: (best.y + wh) / h,
    score: best.score,
  };
}

// 시각화: 원본 + 탐지 박스(빨강) + 엣지맵 미니 히트맵을 합성해 저장
async function visualize(srcBuf, region, outPath) {
  const base = await sharp(srcBuf).resize(CARD_W, CARD_H, { fit: "cover" }).png().toBuffer();
  const bx = Math.round(region.x0 * CARD_W);
  const by = Math.round(region.y0 * CARD_H);
  const bw = Math.round((region.x1 - region.x0) * CARD_W);
  const bh = Math.round((region.y1 - region.y0) * CARD_H);
  const cx = Math.round(region.cx * CARD_W);
  const cy = Math.round(region.cy * CARD_H);
  const overlay = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="rgba(255,0,80,0.18)" stroke="#ff0050" stroke-width="6"/>
      <circle cx="${cx}" cy="${cy}" r="14" fill="#ff0050"/>
    </svg>`);
  await sharp(base).composite([{ input: overlay }]).png().toFile(outPath);
}

async function main() {
  const [, , outDir, ...imgs] = process.argv;
  if (!outDir || imgs.length === 0) {
    console.error("usage: node scripts/ws-detect.mjs <out-dir> <img...>");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < imgs.length; i++) {
    const src = imgs[i];
    const t0 = Date.now();
    const buf = await loadToBuffer(src);
    const map = await edgeMap(buf);
    const region = findEmptiest(map, AW, AH, WIN_W, WIN_H);
    const ms = Date.now() - t0;
    const out = path.join(outDir, `ws-${i + 1}.png`);
    await visualize(buf, region, out);
    console.log(
      `#${i + 1} ${src.slice(-40)}  center=(${region.cx.toFixed(2)},${region.cy.toFixed(2)})  ` +
      `band=${region.cy < 0.4 ? "top" : region.cy > 0.6 ? "bottom" : "center"}  score=${region.score.toFixed(0)}  ${ms}ms  -> ${out}`
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
