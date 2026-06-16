import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!isAdminUser(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("generation_logs")
    .select("id, card_name, card_message, prompt, model, bg, status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    const isMissing = error.code === "42P01" || error.message.includes("does not exist");
    if (isMissing) return NextResponse.json({ logs: [], setup_needed: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
