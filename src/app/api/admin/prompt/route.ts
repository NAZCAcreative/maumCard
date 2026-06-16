import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_CODES = ["COMPOSE_PROMPT", "COMPOSE_PROMPT_LONG", "COMPOSE_PROMPT_HAND"] as const;
type PromptCode = (typeof ALLOWED_CODES)[number];

function resolveCode(raw: string | null): PromptCode {
  if (raw && (ALLOWED_CODES as readonly string[]).includes(raw)) return raw as PromptCode;
  return "COMPOSE_PROMPT";
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user)) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = resolveCode(new URL(request.url).searchParams.get("code"));

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .select("template")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/admin/prompt] DB error:", error.message, error.code);
    if (error.code === "PGRST205" || error.message.includes("card_prompt_templates")) {
      return NextResponse.json({ prompt: null, setup_needed: true });
    }
    return NextResponse.json({ prompt: null });
  }

  return NextResponse.json({ prompt: data?.template ?? null });
}

export async function PUT(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { prompt?: string; code?: string };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "프롬프트가 비어 있습니다." }, { status: 400 });
  }

  const code = resolveCode(body.code ?? null);
  const isLong = code === "COMPOSE_PROMPT_LONG";
  const isHand = code === "COMPOSE_PROMPT_HAND";

  const { error } = await supabaseAdmin.from("card_prompt_templates").upsert(
    {
      code,
      purpose: "system",
      name: isHand ? "Compose prompt (hand)" : isLong ? "Compose prompt (long)" : "Compose prompt (short)",
      description: isHand
        ? "Admin-managed prompt for handwritten letter card composition"
        : isLong
          ? "Admin-managed prompt for long-form AI card composition"
          : "Admin-managed prompt for AI card composition",
      template: prompt,
      style: "system",
      is_active: true,
      sort_order: isHand ? 2 : isLong ? 1 : 0,
    },
    { onConflict: "code" },
  );

  if (error) {
    console.error("[PUT /api/admin/prompt] DB error:", error.message, error.code);
    if (error.code === "PGRST205" || error.message.includes("card_prompt_templates")) {
      return NextResponse.json(
        { error: "card_prompt_templates 테이블이 없습니다. 009_admin_prompt.sql을 실행하세요." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
