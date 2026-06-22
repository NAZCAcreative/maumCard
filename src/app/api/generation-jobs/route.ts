import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";

type EnqueueResult = {
  job_id: string;
  job_status: string;
  balance: number;
  created: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit({
    key: `generation-job:${user.id}:${getRequestIp(request)}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const body = await request.json().catch(() => ({})) as {
    type?: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  };
  if (body.type !== "ai_background") {
    return NextResponse.json({ error: "지원하지 않는 생성 유형입니다." }, { status: 400 });
  }
  if (!body.payload || typeof body.payload.prompt !== "string" || !body.payload.prompt.trim()) {
    return NextResponse.json({ error: "prompt가 필요합니다." }, { status: 400 });
  }

  const idempotencyKey = body.idempotencyKey?.trim()
    || request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return NextResponse.json({ error: "유효한 idempotencyKey가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("enqueue_generation_job", {
    p_job_type: body.type,
    p_payload: body.payload,
    p_idempotency_key: idempotencyKey,
    p_credit_cost: 1,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return NextResponse.json(
        { error: "크레딧이 부족합니다.", code: "insufficient_credits" },
        { status: 402, headers: rateLimitHeaders(rateLimit) },
      );
    }
    console.error("[generation-jobs] enqueue failed:", error);
    return NextResponse.json(
      { error: "생성 요청을 등록하지 못했습니다." },
      { status: 500, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const result = (Array.isArray(data) ? data[0] : data) as EnqueueResult | undefined;
  return NextResponse.json(
    {
      id: result?.job_id,
      status: result?.job_status ?? "queued",
      balance: result?.balance,
      created: result?.created ?? true,
    },
    { status: result?.created === false ? 200 : 202, headers: rateLimitHeaders(rateLimit) },
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id, job_type, status, result, error_message, attempts, created_at, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "생성 내역을 불러오지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ jobs: data });
}

