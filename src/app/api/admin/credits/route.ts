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
  const userId = searchParams.get("user_id");
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "100") || 100);

  let query = supabaseAdmin
    .from("credit_transactions")
    .select("id, user_id, amount, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((t) => t.user_id))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, nickname").in("id", userIds)
    : { data: [] };

  const nicknameMap = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  const transactions = (data ?? []).map((t) => ({
    ...t,
    nickname: nicknameMap.get(t.user_id) ?? null,
  }));

  const summary = {
    total_charged: transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    total_used: transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
    count: transactions.length,
  };

  return NextResponse.json({ transactions, summary });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    amount?: number;
    reason?: string;
  };

  if (!body.user_id || typeof body.amount !== "number" || body.amount === 0 || !body.reason?.trim()) {
    return NextResponse.json({ error: "user_id, amount(≠0), reason이 필요합니다." }, { status: 400 });
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
      reason: `[관리자] ${body.reason.trim()}`,
    }),
  ]);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

  return NextResponse.json({ ok: true, new_credits: newCredits }, { status: 201 });
}
