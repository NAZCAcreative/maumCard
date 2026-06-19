import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("ai_suggestions_enabled, ai_background_enabled, ai_compose_enabled, announcement_enabled, announcement_title, announcement_message, hand_font_round_enabled, hand_font_brush_enabled, hand_font_pen_enabled, hand_paper_enabled, hand_paper_style, hand_compose_font_size, hand_viewer_font_size, whitespace_test_enabled")
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
  });
}
