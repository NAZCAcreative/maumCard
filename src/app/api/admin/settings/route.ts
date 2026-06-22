import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CARD_FONTS } from "@/lib/card-fonts";

const DEFAULT_ENABLED_FONTS = CARD_FONTS.map((f) => f.id);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!isAdminUser(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

const SELECT_COLUMNS =
  "signup_bonus_credits, ai_suggestions_enabled, ai_background_enabled, ai_compose_enabled, announcement_enabled, announcement_title, announcement_message, hand_font_round_enabled, hand_font_brush_enabled, hand_font_pen_enabled, hand_paper_enabled, hand_paper_style, hand_compose_font_size, hand_viewer_font_size, whitespace_test_enabled, click_effect_bubbles_enabled, click_effect_spring_enabled, enabled_fonts, updated_at";

function missingHint(message: string) {
  if (message.includes("click_effect_") || message.includes("enabled_fonts")) return "클릭효과/개별폰트 컬럼";
  if (message.includes("hand_font_") || message.includes("hand_paper_")) return "손편지 글씨체/편지지 컬럼";
  if (message.includes("announcement_")) return "공지 컬럼";
  return "system_settings 확장 컬럼";
}

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await supabaseAdmin.from("system_settings").select(SELECT_COLUMNS).eq("id", "default").single();

  if (error) {
    const isMissing =
      error.code === "42P01" ||
      error.code === "42703" ||
      error.code === "PGRST116" ||
      error.message.includes("does not exist") ||
      error.message.includes("column");

    if (isMissing) {
      const hint = missingHint(error.message);
      return NextResponse.json({
        settings: {
          signup_bonus_credits: 3,
          ai_suggestions_enabled: true,
          ai_background_enabled: false,
          ai_compose_enabled: false,
          announcement_enabled: false,
          announcement_title: "",
          announcement_message: "",
          hand_font_round_enabled: true,
          hand_font_brush_enabled: true,
          hand_font_pen_enabled: true,
          hand_paper_enabled: true,
          hand_paper_style: "hanji",
          hand_compose_font_size: 18,
          hand_viewer_font_size: 18,
          whitespace_test_enabled: false,
          click_effect_bubbles_enabled: true,
          click_effect_spring_enabled: true,
          enabled_fonts: DEFAULT_ENABLED_FONTS,
          updated_at: new Date().toISOString(),
        },
        setup_needed: true,
        missing_columns_hint: hint,
        error: `system_settings 테이블에 ${hint}이 없습니다. 023_cute_interactions_and_fonts.sql 마이그레이션을 실행하세요.`,
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Ensure default values exist if database query was successful but columns were missing or null
  const settings = {
    ...data,
    click_effect_bubbles_enabled: data.click_effect_bubbles_enabled ?? true,
    click_effect_spring_enabled: data.click_effect_spring_enabled ?? true,
    enabled_fonts: data.enabled_fonts ?? DEFAULT_ENABLED_FONTS,
  };

  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    signup_bonus_credits?: number;
    ai_suggestions_enabled?: boolean;
    ai_background_enabled?: boolean;
    ai_compose_enabled?: boolean;
    announcement_enabled?: boolean;
    announcement_title?: string;
    announcement_message?: string;
    hand_font_round_enabled?: boolean;
    hand_font_brush_enabled?: boolean;
    hand_font_pen_enabled?: boolean;
    hand_paper_enabled?: boolean;
    hand_paper_style?: string;
    hand_compose_font_size?: number;
    hand_viewer_font_size?: number;
    whitespace_test_enabled?: boolean;
    click_effect_bubbles_enabled?: boolean;
    click_effect_spring_enabled?: boolean;
    enabled_fonts?: string[];
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.signup_bonus_credits === "number" && body.signup_bonus_credits >= 0) updates.signup_bonus_credits = body.signup_bonus_credits;
  if (typeof body.ai_suggestions_enabled === "boolean") updates.ai_suggestions_enabled = body.ai_suggestions_enabled;
  if (typeof body.ai_background_enabled === "boolean") updates.ai_background_enabled = body.ai_background_enabled;
  if (typeof body.ai_compose_enabled === "boolean") updates.ai_compose_enabled = body.ai_compose_enabled;
  if (typeof body.announcement_enabled === "boolean") updates.announcement_enabled = body.announcement_enabled;
  if (typeof body.announcement_title === "string") updates.announcement_title = body.announcement_title.trim();
  if (typeof body.announcement_message === "string") updates.announcement_message = body.announcement_message.trim();
  if (typeof body.hand_font_round_enabled === "boolean") updates.hand_font_round_enabled = body.hand_font_round_enabled;
  if (typeof body.hand_font_brush_enabled === "boolean") updates.hand_font_brush_enabled = body.hand_font_brush_enabled;
  if (typeof body.hand_font_pen_enabled === "boolean") updates.hand_font_pen_enabled = body.hand_font_pen_enabled;
  if (typeof body.hand_paper_enabled === "boolean") updates.hand_paper_enabled = body.hand_paper_enabled;
  if (typeof body.hand_paper_style === "string") updates.hand_paper_style = body.hand_paper_style.trim();
  if (typeof body.hand_compose_font_size === "number" && body.hand_compose_font_size >= 12) updates.hand_compose_font_size = body.hand_compose_font_size;
  if (typeof body.hand_viewer_font_size === "number" && body.hand_viewer_font_size >= 12) updates.hand_viewer_font_size = body.hand_viewer_font_size;
  if (typeof body.whitespace_test_enabled === "boolean") updates.whitespace_test_enabled = body.whitespace_test_enabled;
  if (typeof body.click_effect_bubbles_enabled === "boolean") updates.click_effect_bubbles_enabled = body.click_effect_bubbles_enabled;
  if (typeof body.click_effect_spring_enabled === "boolean") updates.click_effect_spring_enabled = body.click_effect_spring_enabled;
  if (Array.isArray(body.enabled_fonts) && body.enabled_fonts.every((f) => typeof f === "string")) {
    updates.enabled_fonts = body.enabled_fonts;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "변경할 설정값이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .upsert({ id: "default", ...updates }, { onConflict: "id" })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "42703" || error.message.includes("does not exist") || error.message.includes("column")) {
      const hint = missingHint(error.message);
      return NextResponse.json(
        {
          error: `system_settings 테이블에 ${hint}이 없습니다. 023_cute_interactions_and_fonts.sql 마이그레이션을 실행하세요.`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = {
    ...data,
    click_effect_bubbles_enabled: data.click_effect_bubbles_enabled ?? true,
    click_effect_spring_enabled: data.click_effect_spring_enabled ?? true,
    enabled_fonts: data.enabled_fonts ?? DEFAULT_ENABLED_FONTS,
  };

  return NextResponse.json({ settings });
}

