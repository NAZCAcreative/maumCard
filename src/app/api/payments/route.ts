import { NextResponse } from "next/server";
import { changeCredits } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/toss";

interface TossConfirmResponse {
  status?: string;
  message?: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
    planId?: string;
  };

  const { paymentKey, orderId, amount, planId } = body;

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: "결제 정보가 누락되었습니다." }, { status: 400 });
  }

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.price !== amount) {
    return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (secretKey) {
    const encoded = Buffer.from(`${secretKey}:`).toString("base64");
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = (await tossRes.json().catch(() => ({}))) as TossConfirmResponse;
    if (!tossRes.ok || tossData.status !== "DONE") {
      return NextResponse.json(
        { error: tossData.message ?? "결제 승인에 실패했습니다." },
        { status: 400 },
      );
    }
  }

  const credit = await changeCredits(supabase, {
    amount: plan.credits,
    reason: `purchase:${plan.id}:${orderId}`,
    idempotencyKey: `purchase:${orderId}`,
  });

  return NextResponse.json({
    status: "paid",
    credits: plan.credits,
    balance: credit.balance,
    applied: credit.applied,
  });
}
