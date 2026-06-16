import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  if (!body.text?.trim()) return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });

  // Check credits
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (!profile || profile.credits < 1) {
    return NextResponse.json({ error: "크레딧이 부족합니다. AI 교정은 1크레딧이 필요합니다." }, { status: 402 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI 서비스를 사용할 수 없습니다." }, { status: 503 });

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
            content: [
              "You are a Korean writing editor who corrects spelling and makes text more emotionally warm and elegant.",
              "Return only JSON with a single 'corrected' string field containing the edited Korean text.",
              "Keep the original meaning and structure. Fix typos, spacing errors, and awkward phrasing.",
              "Make the tone more heartfelt, sincere, and poetic without being overly dramatic.",
              "Do not add extra sentences. Maintain paragraph breaks (\\n\\n).",
            ].join(" "),
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

    const parsed = JSON.parse(raw) as { corrected?: string };
    if (!parsed.corrected?.trim()) throw new Error("교정 결과가 없습니다.");

    // Deduct 1 credit
    try {
      await supabaseAdmin.from("profiles").update({ credits: Math.max(0, profile.credits - 1) }).eq("id", user.id);
      await supabaseAdmin.from("credit_transactions").insert({ user_id: user.id, amount: -1, reason: "AI 맞춤법 교정" });
    } catch {
      // non-critical
    }

    return NextResponse.json({ corrected: parsed.corrected.trim() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI 교정 실패" }, { status: 500 });
  }
}
