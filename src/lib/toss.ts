export interface TossPaymentParams {
  amount: number;
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerName?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TossPayments: (clientKey: string) => any;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("toss-payments-sdk")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "toss-payments-sdk";
    script.src = "https://js.tosspayments.com/v1/payment";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Toss Payments SDK 로드 실패"));
    document.head.appendChild(script);
  });
}

export async function requestPayment(params: TossPaymentParams) {
  await loadScript();
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) throw new Error("Toss client key not configured");

  const toss = window.TossPayments(clientKey);
  await toss.requestPayment("카드", {
    amount: params.amount,
    orderId: params.orderId,
    orderName: params.orderName,
    customerName: params.customerName ?? "마음카드 사용자",
    successUrl: params.successUrl,
    failUrl: params.failUrl,
  });
}

export const PLANS = [
  { id: "basic", name: "기본 플랜", credits: 5, price: 1900 },
  { id: "standard", name: "스탠다드 플랜", credits: 50, price: 14900 },
] as const;
