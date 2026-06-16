import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderCardImage, type CardFont, type TextPosition } from "@/lib/card-text-render";
import { composeCardWithAI } from "@/lib/card-ai-compose";
import { loadBackground, resolveAccent } from "@/lib/card-background";
import { resolveCardFontId } from "@/lib/card-fonts";

type CardImageRequest = {
  name?: string;
  message?: string;
  bg?: string;
  purpose?: string;
  hand_font?: string;
  hand_tone?: string;
  hand_mode?: "recommend" | "direct";
  hand_paper_style?: string;
  hand_paper_enabled?: boolean;
  recipient_label?: string;
  api_mode?: "pay" | "sub";
  // 기본은 무료 로컬 텍스트 합성. ai_compose=true 일 때만 OpenAI 감성 합성(card-ai-compose).
  ai_compose?: boolean;
  font?: CardFont;
  title_font?: CardFont; // 제목 글씨체
  content_font?: CardFont; // 내용 글씨체
  // 자동 핏 수동 조정
  position?: TextPosition;
  title_scale?: number;
  content_scale?: number;
  sub_text?: string; // 추가 문구
  title_color?: string; // 제목 글자색 (hex 또는 "auto")
  content_color?: string; // 내용 글자색 (hex 또는 "auto")
};

const DEFAULT_NAME = "문주님";
const DEFAULT_MESSAGE = "진심을 담아 오늘도 응원합니다.";

// 폰트 id 검증 (레지스트리에 없으면 기본 pen)
function resolveFont(font: CardFont | undefined, handFont: string | undefined): CardFont {
  if (font) return resolveCardFontId(font);
  if (handFont === "serif" || handFont === "myeongjo") return "serif";
  return "pen";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CardImageRequest;
  const name = body.name?.trim() || DEFAULT_NAME;
  const message = body.message?.trim() || DEFAULT_MESSAGE;
  const bg = body.bg?.trim() || "flower";
  const purpose = body.purpose?.trim() || "";
  const handFont = body.hand_font?.trim();
  const handTone = body.hand_tone?.trim();
  const handMode = body.hand_mode;
  const handPaperStyle = body.hand_paper_style?.trim();
  const handPaperEnabled = body.hand_paper_enabled;
  const recipientLabel = body.recipient_label?.trim();
  const apiMode = body.api_mode ?? "sub";
  const aiCompose = body.ai_compose === true;
  const font = resolveFont(body.font, handFont);

  // ── 기본 경로: 무료 로컬 텍스트 합성 (즉시·한글 정확·OpenAI 미사용) ──
  if (!aiCompose) {
    try {
      const backgroundBuffer = await loadBackground(bg);
      const imageBuffer = await renderCardImage({
        recipientLabel: recipientLabel ?? "", // 제목 (없으면 제목 없이 렌더)
        message,
        backgroundBuffer,
        accent: resolveAccent(bg),
        font,
        titleFont: body.title_font ? resolveCardFontId(body.title_font) : font,
        contentFont: body.content_font ? resolveCardFontId(body.content_font) : font,
        position: body.position,
        titleScale: body.title_scale,
        contentScale: body.content_scale,
        subText: body.sub_text,
        titleColor: body.title_color,
        contentColor: body.content_color,
      });
      return new NextResponse(new Uint8Array(imageBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "X-Render-Mode": "local-text",
          "X-Card-Font": font,
        },
      });
    } catch (error) {
      console.error("[card-image] local text render failed:", error);
      return NextResponse.json({ error: "카드 이미지 생성에 실패했습니다." }, { status: 500 });
    }
  }

  // ── 옵션 경로: AI(OpenAI) 감성 합성 — 별도 모듈(card-ai-compose) ──
  let usedPrompt = "";
  let usedModel = "";
  try {
    const backgroundBuffer = await loadBackground(bg);
    const { imageBuffer, prompt, model } = await composeCardWithAI({
      backgroundBuffer,
      name,
      message,
      purpose,
      handFont,
      handTone,
      handPaperStyle,
      handPaperEnabled,
      handMode,
      recipientLabel,
      apiMode,
    });
    usedPrompt = prompt;
    usedModel = model;

    void (async () => {
      await supabaseAdmin.from("generation_logs").insert({
        card_name: name,
        card_message: message,
        prompt,
        model,
        bg,
        status: "success",
      });
    })().catch(() => {});

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Render-Mode": "ai-compose",
        "X-AI-Prompt": encodeURIComponent(prompt),
        "X-AI-Model": model,
      },
    });
  } catch (error) {
    console.error("[card-image] AI composition failed:", error);
    const errMsg = error instanceof Error ? error.message : "unknown";
    if (usedPrompt) {
      void (async () => {
        await supabaseAdmin.from("generation_logs").insert({
          card_name: name,
          card_message: message,
          prompt: usedPrompt,
          model: usedModel,
          bg,
          status: "error",
          error_message: errMsg,
        });
      })().catch(() => {});
    }
    return NextResponse.json({ error: "카드 이미지 생성에 실패했습니다." }, { status: 500 });
  }
}
