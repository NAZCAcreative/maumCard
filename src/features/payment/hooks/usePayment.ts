"use client";

import { useState } from "react";
import { requestPayment, PLANS } from "@/lib/toss";

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = async (planId: string, customerName?: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return;

    setLoading(true);
    setError(null);
    try {
      const orderId = `${planId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await requestPayment({
        amount: plan.price,
        orderId,
        orderName: `마음카드 ${plan.name} (${plan.credits}크레딧)`,
        customerName,
        successUrl: `${window.location.origin}/payment/success?planId=${planId}`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return { loading, error, purchase };
}
