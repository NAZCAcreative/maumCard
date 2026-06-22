import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CARD_FONTS } from "@/lib/card-fonts";

const DEFAULT_ENABLED_FONTS = CARD_FONTS.map((f) => f.id);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select(
      "ai_suggestions_enabled, ai_background_enabled, ai_compose_enabled, announcement_enabled, announcement_title, announcement_message, hand_font_round_enabled, hand_font_brush_enabled, hand_font_pen_enabled, hand_paper_enabled, hand_paper_style, hand_compose_font_size, hand_viewer_font_size, whitespace_test_enabled, click_effect_bubbles_enabled, click_effect_spring_enabled, enabled_fonts"
    )
    .eq("id", "default")
    .single();

  if (error) {
    return NextResponse.json({
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
    });
  }

  return NextResponse.json({
    ai_suggestions_enabled: data?.ai_suggestions_enabled ?? true,
    ai_background_enabled: data?.ai_background_enabled ?? false,
    ai_compose_enabled: data?.ai_compose_enabled ?? false,
    announcement_enabled: data?.announcement_enabled ?? false,
    announcement_title: data?.announcement_title ?? "",
    announcement_message: data?.announcement_message ?? "",
    hand_font_round_enabled: data?.hand_font_round_enabled ?? true,
    hand_font_brush_enabled: data?.hand_font_brush_enabled ?? true,
    hand_font_pen_enabled: data?.hand_font_pen_enabled ?? true,
    hand_paper_enabled: data?.hand_paper_enabled ?? true,
    hand_paper_style: data?.hand_paper_style ?? "hanji",
    hand_compose_font_size: data?.hand_compose_font_size ?? 18,
    hand_viewer_font_size: data?.hand_viewer_font_size ?? 18,
    whitespace_test_enabled: data?.whitespace_test_enabled ?? false,
    click_effect_bubbles_enabled: data?.click_effect_bubbles_enabled ?? true,
    click_effect_spring_enabled: data?.click_effect_spring_enabled ?? true,
    enabled_fonts: data?.enabled_fonts ?? DEFAULT_ENABLED_FONTS,
  });
}

