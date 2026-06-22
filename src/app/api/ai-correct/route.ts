import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { changeCredits, InsufficientCreditsError } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

// Vercel: OpenAI 호출 지연 대비 실행시간 상향(기본 10s, Pro 플랜에서 적용).
export const maxDuration = 60;

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string; tone?: string };
  if (!body.text?.trim()) return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });

  // 느낌(말투) 옵션 — 클라이언트 AI_TONE_OPTIONS의 id와 1:1 매칭.
  const TONE_INSTRUCTIONS: Record<string, string> = {
    warm: "따뜻하고 다정한 말투로 다듬어 주세요.",
    polite: "예의 바르고 공손한 말투로 다듬어 주세요.",
    lovely: "사랑스럽고 애정 어린 말투로 다듬어 주세요.",
    formal: "정중하고 격식 있는 말투로 다듬어 주세요.",
    sincere: "진심이 깊이 느껴지는 담백한 말투로 다듬어 주세요.",
    cheerful: "밝고 유쾌한 말투로 다듬어 주세요.",
    poetic: "감성적이고 서정적인 말투로 다듬어 주세요.",
    concise: "군더더기 없이 간결하고 명료한 말투로 다듬어 주세요.",
    comforting: "마음을 위로하는 부드러운 말투로 다듬어 주세요.",
    encouraging: "용기를 주고 격려하는 말투로 다듬어 주세요.",
  };
  const toneDirective = TONE_INSTRUCTIONS[body.tone ?? ""] ?? "전체적으로 따뜻하고 진심이 느껴지도록 다듬어 주세요.";
  const isSpellingOnly = body.tone === "spelling";

  const systemContent = isSpellingOnly
    ? [
        "You are a Korean proofreader. Fix ONLY spelling, typos, and spacing (띄어쓰기) errors.",
        "Do NOT change wording, expression, or tone. Keep the original style fully intact.",
        "Return only JSON with a 'corrected' field that is an array containing exactly 1 corrected Korean text.",
        "Maintain paragraph breaks (\\n\\n).",
      ].join(" ")
    : [
        "You are a Korean writing editor who corrects spelling and rewrites the text to match a requested tone.",
        "Return only JSON with a 'corrected' field that is an array of exactly 2 distinct Korean rewrites.",
        "Both rewrites must keep the original meaning and structure, and fix typos, spacing errors, and awkward phrasing.",
        `Tone instruction (Korean): ${toneDirective}`,
        "Apply that tone naturally without being overly dramatic.",
        "Make the first rewrite stay close to the original wording; make the second a little more expressive.",
        "Do not add extra sentences. Maintain paragraph breaks (\\n\\n).",
      ].join(" ");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI 서비스를 사용할 수 없습니다." }, { status: 503 });

  const requestKey = request.headers.get("idempotency-key")?.trim() || randomUUID();
  let creditReserved = false;
  try {
    const credit = await changeCredits(supabase, {
      amount: -1,
      reason: "AI 문장 수정",
      idempotencyKey: `ai-correct:${requestKey}`,
    });
    creditReserved = credit.applied;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "크레딧이 부족합니다. AI 교정은 1크레딧이 필요합니다." }, { status: 402 });
    }
    return NextResponse.json({ error: "크레딧 처리에 실패했습니다." }, { status: 500 });
  }

  try {
    const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: JSON.stringify({ text: body.text.trim() }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
    if (!res.ok) throw new Error(data.error?.message ?? "AI 오류");

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("응답이 없습니다.");

    const parsed = JSON.parse(raw) as { corrected?: string[] | string };
    const options = (Array.isArray(parsed.corrected) ? parsed.corrected : parsed.corrected ? [parsed.corrected] : [])
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (options.length === 0) throw new Error("수정 결과가 없습니다.");

    return NextResponse.json({ corrected: options });
  } catch (err) {
    if (creditReserved) {
      try {
        await changeCredits(supabase, {
          amount: 1,
          reason: "AI 문장 수정 환불",
          idempotencyKey: `ai-correct-refund:${requestKey}`,
        });
      } catch (refundError) {
        console.error("[ai-correct] credit refund failed:", refundError);
      }
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI 교정 실패" }, { status: 500 });
  }
}
