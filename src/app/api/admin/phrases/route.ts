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

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await supabaseAdmin
    .from("curated_phrases")
    .select("*")
    .order("category", { ascending: true })
    .order("phrase_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    const isMissing = error.code === "42P01" || error.message.includes("does not exist") || error.code === "PGRST116";
    if (isMissing) return NextResponse.json({ phrases: [], setup_needed: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phrases: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    phrase_type?: string;
    content?: string;
    sort_order?: number;
  };

  if (!body.category?.trim()) return NextResponse.json({ error: "category가 필요합니다." }, { status: 400 });
  if (!body.content?.trim()) return NextResponse.json({ error: "content가 필요합니다." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("curated_phrases")
    .insert({
      category: body.category.trim(),
      phrase_type: body.phrase_type?.trim() || "short",
      content: body.content.trim(),
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phrase: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    content?: string;
    is_active?: boolean;
    sort_order?: number;
    swaps?: { id: string; sort_order: number }[];
  };

  // Batch swap sort orders
  if (body.swaps && Array.isArray(body.swaps)) {
    const results = await Promise.all(
      body.swaps.map(({ id, sort_order }) =>
        supabaseAdmin.from("curated_phrases").update({ sort_order, updated_at: new Date().toISOString() }).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.content === "string") updates.content = body.content.trim();
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("curated_phrases")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ phrase: data });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { error } = await supabaseAdmin.from("curated_phrases").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
