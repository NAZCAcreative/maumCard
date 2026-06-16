"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { PaymentModal } from "./PaymentModal";

interface CreditBalanceProps {
  credits: number;
  customerName?: string;
  onCharged?: () => void;
}

export function CreditBalance({ credits, customerName, onCharged }: CreditBalanceProps) {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    onCharged?.();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-[#7b310d] transition hover:bg-orange-100"
      >
        <Star size={15} className="fill-amber-400 text-amber-400" />
        크레딧 {credits}개
        <span className="ml-1 rounded-md bg-[#7b310d] px-2 py-0.5 text-xs text-white">충전</span>
      </button>

      {open && (
        <PaymentModal onClose={handleClose} customerName={customerName} />
      )}
    </>
  );
}
