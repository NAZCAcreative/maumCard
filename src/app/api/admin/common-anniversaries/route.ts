import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const [itemsRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from("common_anniversaries")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("common_anniversary_settings")
      .select("*")
      .eq("id", "home")
      .maybeSingle(),
  ]);

  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });

  return NextResponse.json({
    anniversaries: itemsRes.data ?? [],
    settings: settingsRes.data ?? { id: "home", max_visible: 3, window_days: 7 },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!id || !name) return NextResponse.json({ error: "id와 name이 필요합니다." }, { status: 400 });

  const month = body.month === null || body.month === "" ? null : Number(body.month);
  const day = body.day === null || body.day === "" ? null : Number(body.day);
  const yearly_dates = typeof body.yearly_dates === "object" && body.yearly_dates !== null ? body.yearly_dates : {};

  const { data, error } = await supabaseAdmin
    .from("common_anniversaries")
    .insert({
      id,
      name,
      month,
      day,
      yearly_dates,
      anniversary_type: String(body.anniversary_type ?? "other"),
      memo: String(body.memo ?? ""),
      is_active: body.is_active !== false,
      sort_order: Number(body.sort_order ?? 0),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anniversary: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (body.settings) {
    const settings = body.settings as Record<string, unknown>;
    const { data, error } = await supabaseAdmin
      .from("common_anniversary_settings")
      .upsert({
        id: "home",
        max_visible: Number(settings.max_visible ?? 3),
        window_days: Number(settings.window_days ?? 7),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["name", "anniversary_type", "memo", "is_active", "sort_order", "yearly_dates"]) {
    if (key in body) updates[key] = body[key];
  }
  if ("month" in body) updates.month = body.month === "" ? null : body.month;
  if ("day" in body) updates.day = body.day === "" ? null : body.day;

  const { data, error } = await supabaseAdmin
    .from("common_anniversaries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anniversary: data });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { error } = await supabaseAdmin.from("common_anniversaries").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
