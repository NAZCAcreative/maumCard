import { NextResponse } from "next/server";
import { loadBackground, type BgFilter } from "@/lib/card-background";
import { detectWhitespace } from "@/lib/card-whitespace";

// 빈영역 탐지 테스트용. bg(배경 키/URL/ai:/data:) → 탐지된 빈 영역(정규화 0~1) 반환.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    bg?: string;
    bg_filter?: string;
    looseness?: number;
  };
  const bg = body.bg?.trim() || "flower";
  const bgFilter = (body.bg_filter?.trim() || "none") as BgFilter;

  try {
    const backgroundBuffer = await loadBackground(bg, bgFilter);
    const t0 = Date.now();
    const region = await detectWhitespace(backgroundBuffer, { looseness: body.looseness });
    return NextResponse.json({ region, ms: Date.now() - t0 });
  } catch (error) {
    console.error("[whitespace] detect failed:", error);
    return NextResponse.json({ error: "빈영역 탐지에 실패했습니다." }, { status: 500 });
  }
}
