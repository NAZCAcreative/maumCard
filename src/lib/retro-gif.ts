// 카드 이미지 + 레트로 반짝이 효과를 움직이는 GIF 한 장으로 인코딩.
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { drawRetroFrame, makeSparkles, type GifEffectId } from "./retro-effect";

const GIF_MAX_WIDTH = 320; // GIF 용량/속도 위해 폭 제한 (카드 3:4)
const GIF_FRAMES = 18;
const GIF_DELAY_MS = 300;

// fetch → blob → objectURL 로 같은-출처 이미지를 만들어 canvas 오염(taint)을 피한다.
async function loadImageViaBlob(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = objectUrl;
    });
    return img;
  } finally {
    // src 가 디코드된 뒤이므로 곧바로 revoke 가능하지만,
    // 안전하게 다음 틱에 해제.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

export async function generateRetroGif(imageUrl: string, effect: GifEffectId = "sparkle"): Promise<Blob> {
  const img = await loadImageViaBlob(imageUrl);

  const ratio = img.naturalHeight / img.naturalWidth || 4 / 3;
  const w = GIF_MAX_WIDTH;
  const h = Math.round(w * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas context 생성 실패");

  const sparkles = makeSparkles(26);
  const gif = GIFEncoder();

  for (let i = 0; i < GIF_FRAMES; i++) {
    const progress = i / GIF_FRAMES;
    drawRetroFrame(ctx, img, w, h, progress, sparkles, effect);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay: GIF_DELAY_MS });
  }

  gif.finish();
  // 새 ArrayBuffer 기반 배열로 복사 → BlobPart 타입 호환.
  const view = gif.bytesView();
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return new Blob([out], { type: "image/gif" });
}
