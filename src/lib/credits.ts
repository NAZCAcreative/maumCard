type CreditMutationResult = {
  balance: number;
  applied: boolean;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

export async function changeCredits(
  client: RpcClient,
  input: { amount: number; reason: string; idempotencyKey: string },
): Promise<CreditMutationResult> {
  const { data, error } = await client.rpc("change_my_credits", {
    p_amount: input.amount,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(error.message || "credit_transaction_failed");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("credit_transaction_returned_no_result");
  }

  const result = row as { balance?: unknown; applied?: unknown };
  return {
    balance: Number(result.balance ?? 0),
    applied: result.applied === true,
  };
}
