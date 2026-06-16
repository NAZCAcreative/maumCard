import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!isAdminUser(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { searchParams } = new URL(request.url);

  if (searchParams.get("type") === "cards") {
    const { data, error } = await supabaseAdmin
      .from("cards")
      .select("id, message, card_image_url, created_at, purpose")
      .eq("user_id", admin.user.id)
      .not("card_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cards: data ?? [] });
  }

  const { data, error } = await supabaseAdmin
    .from("home_featured_cards")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    const isMissing = error.code === "42P01" || error.message.includes("does not exist");
    return NextResponse.json({ error: error.message, setup_needed: isMissing }, { status: 500 });
  }

  return NextResponse.json({ cards: data ?? [] });
}

function autoTitle() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `오늘의카드_${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    message?: string;
    image_url?: string;
    link_href?: string;
    cta_label?: string;
    is_active?: boolean;
    show_title?: boolean;
    show_text?: boolean;
    sort_order?: number;
  };

  if (!body.image_url?.trim()) {
    return NextResponse.json({ error: "image_url이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("home_featured_cards")
    .insert({
      title: body.title?.trim() || autoTitle(),
      message: body.message?.trim() || "",
      image_url: body.image_url.trim(),
      link_href: body.link_href?.trim() || "/create",
      cta_label: body.cta_label?.trim() || "카드 만들기",
      is_active: body.is_active ?? true,
      show_title: body.show_title ?? true,
      show_text: body.show_text ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "multipart/form-data가 필요합니다." }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file 필드가 필요합니다." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `home-cards/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("backgrounds")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("backgrounds")
    .getPublicUrl(uploadData.path);

  return NextResponse.json({ url: publicUrl });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    message?: string;
    image_url?: string;
    link_href?: string;
    cta_label?: string;
    is_active?: boolean;
    show_title?: boolean;
    show_text?: boolean;
    sort_order?: number;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of ["title", "message", "image_url", "link_href", "cta_label"] as const) {
    const value = body[key];
    if (typeof value === "string") updates[key] = value.trim();
  }
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.show_title === "boolean") updates.show_title = body.show_title;
  if (typeof body.show_text === "boolean") updates.show_text = body.show_text;
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("home_featured_cards")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ card: data });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("home_featured_cards").delete().eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
