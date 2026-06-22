import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, job_type, status, result, error_message, attempts, created_at, completed_at")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "생성 작업을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(data);
}

