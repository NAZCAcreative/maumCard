import { useState, useCallback } from "react";

interface AIBackgroundState {
  loading: boolean;
  progress: number;
  url: string | null;
  error: string | null;
}

interface AIBackgroundContext {
  purpose?: string;
  promptCode?: string;
  recipient?: string;
  honorific?: string;
  message?: string;
}

type GenerationJob = {
  status: "queued" | "processing" | "completed" | "failed";
  result?: { backgroundUrl?: string } | null;
  error_message?: string | null;
};

async function readError(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
  return data.code === "insufficient_credits"
    ? "크레딧이 부족합니다. 마이페이지에서 충전해주세요."
    : (data.error ?? "AI 생성에 실패했습니다.");
}

async function generateSynchronously(prompt: string, context?: AIBackgroundContext) {
  const response = await fetch("/api/ai-background", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ prompt, ...context }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json() as { backgroundUrl: string };
  return data.backgroundUrl;
}

async function generateWithQueue(prompt: string, context?: AIBackgroundContext) {
  const response = await fetch("/api/generation-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "ai_background",
      idempotencyKey: crypto.randomUUID(),
      payload: { prompt, ...context },
    }),
  });
  if (!response.ok) throw new Error(await readError(response));

  const enqueued = await response.json() as { id?: string };
  if (!enqueued.id) throw new Error("생성 작업 ID를 받지 못했습니다.");

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const jobResponse = await fetch(`/api/generation-jobs/${enqueued.id}`, { cache: "no-store" });
    if (!jobResponse.ok) throw new Error(await readError(jobResponse));

    const job = await jobResponse.json() as GenerationJob;
    if (job.status === "completed" && job.result?.backgroundUrl) {
      return job.result.backgroundUrl;
    }
    if (job.status === "failed") {
      throw new Error(job.error_message || "AI 생성에 실패했습니다.");
    }
  }

  throw new Error("AI 생성 대기 시간이 초과되었습니다.");
}

export function useAIBackground() {
  const [state, setState] = useState<AIBackgroundState>({
    loading: false,
    progress: 0,
    url: null,
    error: null,
  });

  const generate = useCallback(async (prompt: string, context?: AIBackgroundContext) => {
    setState({ loading: true, progress: 0, url: null, error: null });

    const interval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        progress: Math.min(prev.progress + 7, 85),
      }));
    }, 700);

    try {
      const backgroundUrl = process.env.NEXT_PUBLIC_ASYNC_GENERATION_ENABLED === "true"
        ? await generateWithQueue(prompt, context)
        : await generateSynchronously(prompt, context);
      clearInterval(interval);
      setState({ loading: false, progress: 100, url: backgroundUrl, error: null });
    } catch (err) {
      clearInterval(interval);
      setState({
        loading: false,
        progress: 0,
        url: null,
        error: err instanceof Error ? err.message : "오류가 발생했습니다.",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, progress: 0, url: null, error: null });
  }, []);

  return { ...state, generate, reset };
}
