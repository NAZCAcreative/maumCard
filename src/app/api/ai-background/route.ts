import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { changeCredits, InsufficientCreditsError } from "@/lib/credits";
import { generateAiBackground } from "@/lib/generation/ai-background";
import { consumeRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Vercel: OpenAI 이미지 생성이 오래 걸릴 수 있어 실행시간 상향(기본 10s, Pro 플랜에서 적용).
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    prompt?: string;
    promptCode?: string;
    purpose?: string;
    recipient?: string;
    message?: string;
  };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rateLimit = await consumeRateLimit({
    key: `ai-background:${user?.id ?? getRequestIp(request)}`,
    limit: user ? 6 : 3,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "AI 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const requestKey = request.headers.get("idempotency-key")?.trim() || randomUUID();
  let creditReserved = false;

  if (user) {
    try {
      const credit = await changeCredits(supabase, {
        amount: -1,
        reason: "ai_generate",
        idempotencyKey: `ai-background:${requestKey}`,
      });
      creditReserved = credit.applied;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "크레딧이 부족합니다. 충전 후 다시 시도해주세요.", code: "insufficient_credits" },
          { status: 402, headers: rateLimitHeaders(rateLimit) },
        );
      }
      console.error("[ai-background] credit reserve failed:", error);
      return NextResponse.json(
        { error: "크레딧 처리에 실패했습니다." },
        { status: 500, headers: rateLimitHeaders(rateLimit) },
      );
    }
  }

  try {
    const generated = await generateAiBackground({
      prompt,
      promptCode: body.promptCode,
      purpose: body.purpose,
      recipient: body.recipient,
      message: body.message,
    });
    const backgroundUrl = generated.buffer
      ? `data:image/png;base64,${generated.buffer.toString("base64")}`
      : generated.externalUrl;

    return NextResponse.json(
      {
        backgroundUrl,
        isAiGenerated: true,
        fallback: generated.fallback || undefined,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    console.error("[ai-background] generation failed:", error);
    if (user && creditReserved) {
      try {
        await changeCredits(supabase, {
          amount: 1,
          reason: "ai_generate_refund",
          idempotencyKey: `ai-background-refund:${requestKey}`,
        });
      } catch (refundError) {
        console.error("[ai-background] credit refund failed:", refundError);
      }
    }
    return NextResponse.json(
      { error: "AI image generation failed." },
      { status: 500, headers: rateLimitHeaders(rateLimit) },
    );
  }
}
