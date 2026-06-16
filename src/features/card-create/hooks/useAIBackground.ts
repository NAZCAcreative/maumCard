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
      const res = await fetch("/api/ai-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...context }),
      });
      clearInterval(interval);
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; code?: string };
        const msg = data.code === "insufficient_credits"
          ? "크레딧이 부족합니다. 마이페이지에서 충전해주세요."
          : (data.error ?? "AI 생성에 실패했습니다.");
        throw new Error(msg);
      }
      const data = (await res.json()) as { backgroundUrl: string };
      setState({ loading: false, progress: 100, url: data.backgroundUrl, error: null });
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
