import { NextResponse } from "next/server";
import { buildCardBackgroundPrompt } from "@/lib/openai/cardPromptTemplates";
import { enhanceBackgroundPrompt } from "@/lib/openai/backgroundPrompt";
import { createClient } from "@/lib/supabase/server";

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
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

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if ((profile?.credits ?? 0) < 1) {
      return NextResponse.json(
        { error: "크레딧이 부족합니다. 충전 후 다시 시도해주세요.", code: "insufficient_credits" },
        { status: 402 },
      );
    }

    await supabase
      .from("profiles")
      .update({ credits: (profile?.credits ?? 1) - 1 })
      .eq("id", user.id);

    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -1,
      reason: "ai_generate",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      backgroundUrl: `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 40))}/1536/2048`,
      isAiGenerated: true,
      fallback: true,
    });
  }

  try {
    const baseImagePrompt = await buildCardBackgroundPrompt({
      purpose: body.purpose,
      promptCode: body.promptCode,
      recipientName: body.recipient,
      message: body.message?.slice(0, 160),
      userPrompt: prompt,
    });
    const imagePrompt = await enhanceBackgroundPrompt({ apiKey, basePrompt: baseImagePrompt });

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
        prompt: imagePrompt,
        n: 1,
        size: "1536x2048",
        quality: "high",
        output_format: "png",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenAIImageResponse;
    if (!res.ok) {
      console.error("OpenAI image generation error:", data);
      return NextResponse.json(
        { error: data.error?.message ?? "AI image generation failed." },
        { status: 500 },
      );
    }

    const image = data.data?.[0];
    const backgroundUrl = image?.b64_json
      ? `data:image/png;base64,${image.b64_json}`
      : image?.url;

    if (!backgroundUrl) {
      console.error("OpenAI image generation returned no image:", data);
      return NextResponse.json({ error: "AI image generation returned no image." }, { status: 500 });
    }

    return NextResponse.json({ backgroundUrl, isAiGenerated: true });
  } catch (error) {
    console.error("AI background error:", error);
    return NextResponse.json({ error: "AI image generation failed." }, { status: 500 });
  }
}
