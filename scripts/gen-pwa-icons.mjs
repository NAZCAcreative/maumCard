// PWA 아이콘 생성: 로고(public/logo_01.png)를 흰 배경의 정사각 캔버스 가운데 배치.
// 사용: node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo_01.png";
const OUT_DIR = "public/icons";
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon(size, padRatio, outName) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT_DIR}/${outName}`);
  console.log(`✓ ${OUT_DIR}/${outName} (${size}x${size})`);
}

await mkdir(OUT_DIR, { recursive: true });
// 일반 아이콘은 여백 적게, maskable 은 안전영역 위해 여백 크게.
await makeIcon(192, 0.12, "icon-192.png");
await makeIcon(512, 0.12, "icon-512.png");
await makeIcon(512, 0.2, "icon-512-maskable.png");
await makeIcon(180, 0.12, "apple-touch-icon.png");
