import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageAdminRoles, isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!isAdminUser(user) || !canManageAdminRoles(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    purpose?: string;
    name?: string;
    description?: string;
    template?: string;
    style?: string;
    is_active?: boolean;
    sort_order?: number;
  };

  if (!body.code?.trim() || !body.purpose?.trim() || !body.name?.trim() || !body.template?.trim()) {
    return NextResponse.json({ error: "code, purpose, name, template은 필수입니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .insert({
      code: body.code.trim().toUpperCase().replace(/\s+/g, "_"),
      purpose: body.purpose.trim(),
      name: body.name.trim(),
      description: body.description?.trim() ?? "",
      template: body.template.trim(),
      style: body.style?.trim() ?? "",
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    description?: string;
    template?: string;
    style?: string;
    is_active?: boolean;
    sort_order?: number;
  };

  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ["name", "description", "template", "style"] as const) {
    if (typeof body[key] === "string") updates[key] = (body[key] as string).trim();
  }
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { error } = await supabaseAdmin.from("card_prompt_templates").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
