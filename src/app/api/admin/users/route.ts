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

  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin
      .from("profiles")
      .select("id, nickname, avatar_url, credits, created_at, updated_at"),
  ]);

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = authData.users.map((authUser) => {
    const profile = profileMap.get(authUser.id);
    return {
      id: authUser.id,
      email: authUser.email ?? null,
      nickname: profile?.nickname ?? null,
      avatar_url: profile?.avatar_url ?? null,
      credits: profile?.credits ?? 0,
      joined_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      has_profile: !!profile,
    };
  }).sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());

  const stats = {
    total: users.length,
    with_profile: users.filter((u) => u.has_profile).length,
    total_credits: users.reduce((s, u) => s + u.credits, 0),
  };

  return NextResponse.json({ users, stats });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    amount?: number;
    reason?: string;
  };

  if (!body.user_id || typeof body.amount !== "number" || !body.reason?.trim()) {
    return NextResponse.json({ error: "user_id, amount, reason이 필요합니다." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", body.user_id)
    .single();

  if (profileError) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const newCredits = Math.max(0, profile.credits + body.amount);

  const [{ error: updateError }, { error: txError }] = await Promise.all([
    supabaseAdmin.from("profiles").update({ credits: newCredits }).eq("id", body.user_id),
    supabaseAdmin.from("credit_transactions").insert({
      user_id: body.user_id,
      amount: body.amount,
      reason: body.reason.trim(),
    }),
  ]);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  return NextResponse.json({ ok: true, new_credits: newCredits });
}
