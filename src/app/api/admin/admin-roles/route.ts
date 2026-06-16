import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageAdminRoles, getAdminRole } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  if (!canManageAdminRoles(user)) return { error: "Forbidden", status: 403 } as const;
  return { user } as const;
}

const ALLOWED_ROLES = ["superadmin", "admin", "operator", "content", "ai", "viewer", "none"] as const;

export async function GET() {
  const admin = await requireSuperAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    role: getAdminRole(u) ?? "none",
    is_admin: Boolean(getAdminRole(u)),
  }));

  return NextResponse.json({
    users: users.sort((a, b) => a.email?.localeCompare(b.email ?? "") ?? 0),
    allowed_roles: ALLOWED_ROLES,
  });
}

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as { user_id?: string; role?: string };
  if (!body.user_id || !body.role) {
    return NextResponse.json({ error: "user_id, role이 필요합니다." }, { status: 400 });
  }

  const role = body.role.trim().toLowerCase();
  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "허용되지 않은 역할입니다." }, { status: 400 });
  }

  const app_metadata =
    role === "none"
      ? { admin_role: null }
      : { admin_role: role };

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(body.user_id, { app_metadata });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: data.user });
}
