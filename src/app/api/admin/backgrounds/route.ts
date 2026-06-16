import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enhanceBackgroundPrompt } from "@/lib/openai/backgroundPrompt";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!isAdminUser(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

    const { data, error } = await supabaseAdmin
      .from("backgrounds")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/backgrounds] Supabase error:", error.message, error.code);
      const isTableMissing = error.code === "42P01" || error.message.includes("does not exist");
      return NextResponse.json(
        { error: error.message, setup_needed: isTableMissing },
        { status: 500 },
      );
    }
    return NextResponse.json({ backgrounds: data ?? [] });
  } catch (e) {
    console.error("[GET /api/admin/backgrounds] Exception:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });
  if (admin.user.email?.toLowerCase() !== "dkpark55@gmail.com") {
    return NextResponse.json({ error: "AI 생성 권한은 dkpark55 계정만 사용할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as {
    prompt?: string;
    name?: string;
    category?: string;
    api_mode?: "pay" | "sub";
  };
  const { prompt, name, category = "nature", api_mode = "sub" } = body;

  if (!prompt?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "prompt와 name이 필요합니다." }, { status: 400 });
  }

  const apiKey = api_mode === "sub"
    ? (process.env.OPENAI_API_KEY_SUB || process.env.OPENAI_API_KEY)
    : process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI API key 미설정" }, { status: 500 });

  // OpenAI 이미지 생성 (9:16 세로 비율 기반 프롬프트)
  const fullPrompt = [
    "Beautiful vertical portrait-format background image for a Korean greeting card.",
    `Theme: ${prompt}`,
    "Style: soft dreamy watercolor or digital painting, warm gentle colors, emotional atmosphere.",
    "Composition: center area should be calm and low-contrast for text overlay readability.",
    "Format: portrait orientation (3:4 ratio feel). No text, no UI, no borders, no watermarks.",
  ].join(" ");
  const imagePrompt = await enhanceBackgroundPrompt({ apiKey, basePrompt: fullPrompt });

  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt: imagePrompt,
      n: 1,
      size: "1536x2048",
      quality: "high",
      output_format: "png",
    }),
  });

  type OAIResp = { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  const oaiData = (await openaiRes.json().catch(() => ({}))) as OAIResp;

  if (!openaiRes.ok) {
    return NextResponse.json(
      { error: oaiData.error?.message ?? "OpenAI 생성 실패" },
      { status: 500 },
    );
  }

  const b64 = oaiData.data?.[0]?.b64_json;
  const remoteUrl = oaiData.data?.[0]?.url;

  let publicUrl = remoteUrl ?? "";

  if (b64) {
    // base64 → Supabase Storage 업로드
    await supabaseAdmin.storage.createBucket("backgrounds", { public: true }).catch(() => {});

    const buffer = Buffer.from(b64, "base64");
    const fileName = `bg-${Date.now()}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("backgrounds")
      .upload(fileName, buffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `스토리지 업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("backgrounds").getPublicUrl(fileName);
    publicUrl = urlData.publicUrl;

    // DB 저장
    const { data: bg, error: dbError } = await supabaseAdmin
      .from("backgrounds")
      .insert({ name: name.trim(), category, storage_path: fileName, url: publicUrl, prompt: prompt.trim() })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ background: bg }, { status: 201 });
  }

  // url 방식 fallback (gpt-image-2가 url 반환하는 경우)
  if (publicUrl) {
    const { data: bg, error: dbError } = await supabaseAdmin
      .from("backgrounds")
      .insert({ name: name.trim(), category, storage_path: "", url: publicUrl, prompt: prompt.trim() })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ background: bg }, { status: 201 });
  }

  return NextResponse.json({ error: "이미지 생성 결과가 없습니다." }, { status: 500 });
}

export async function PUT(request: Request) {
  try {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "FormData 파싱 실패" }, { status: 400 });

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const category = (formData.get("category") as string | null) ?? "nature";

  if (!file || !name) {
    return NextResponse.json({ error: "file과 name이 필요합니다." }, { status: 400 });
  }

  await supabaseAdmin.storage.createBucket("backgrounds", { public: true }).catch(() => {});

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `bg-upload-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("backgrounds")
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("backgrounds").getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  const { data: bg, error: dbError } = await supabaseAdmin
    .from("backgrounds")
    .insert({ name, category, storage_path: fileName, url: publicUrl, prompt: null })
    .select()
    .single();

  if (dbError) {
    console.error("[PUT /api/admin/backgrounds] DB error:", dbError.message, dbError.code);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ background: bg }, { status: 201 });
  } catch (e) {
    console.error("[PUT /api/admin/backgrounds] Exception:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({})) as { id?: string; is_active?: boolean; sort_order?: number; category?: string; duplicate_to?: string };
  const { id, duplicate_to, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  // 중복 등록: 같은 이미지를 다른 카테고리로 복사
  if (duplicate_to !== undefined) {
    const { data: src } = await supabaseAdmin.from("backgrounds").select("*").eq("id", id).single();
    if (!src) return NextResponse.json({ error: "원본 배경 없음" }, { status: 404 });
    const { data: bg, error: dupErr } = await supabaseAdmin
      .from("backgrounds")
      .insert({ name: src.name, category: duplicate_to, storage_path: src.storage_path, url: src.url, prompt: src.prompt })
      .select()
      .single();
    if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
    return NextResponse.json({ background: bg }, { status: 201 });
  }

  const { error } = await supabaseAdmin.from("backgrounds").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({})) as { id?: string; storage_path?: string };
  const { id, storage_path } = body;
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  if (storage_path) {
    await supabaseAdmin.storage.from("backgrounds").remove([storage_path]).catch(() => {});
  }
  const { error } = await supabaseAdmin.from("backgrounds").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
