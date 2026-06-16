"use client";

import { PLANS } from "@/lib/toss";
import { usePayment } from "@/features/payment/hooks/usePayment";
import { Star, X } from "lucide-react";

interface PaymentModalProps {
  onClose: () => void;
  customerName?: string;
}

export function PaymentModal({ onClose, customerName }: PaymentModalProps) {
  const { loading, error, purchase } = usePayment();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black">크레딧 충전</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone-100">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm font-semibold text-stone-500 mb-4">
          AI 배경 생성 1회에 크레딧 1개가 사용됩니다.
        </p>

        <div className="space-y-3">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => purchase(plan.id, customerName)}
              disabled={loading}
              className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-orange-50/40 px-5 py-4 text-left transition hover:border-[#7b310d] hover:bg-orange-50 disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#7b310d] text-white">
                  <Star size={18} className="fill-white" />
                </span>
                <div>
                  <div className="font-black text-[#5a240d]">{plan.name}</div>
                  <div className="text-sm font-semibold text-stone-600">크레딧 {plan.credits}개</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-lg text-[#7b310d]">
                  {plan.price.toLocaleString()}원
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-md bg-stone-100 font-bold text-stone-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}
