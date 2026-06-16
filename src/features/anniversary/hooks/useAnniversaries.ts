import { useState, useCallback, useEffect } from "react";
import {
  getAnniversaries,
  createAnniversary,
  deleteAnniversary,
  type AnniversaryInsertData,
} from "@/lib/anniversaries";
import type { Database } from "@/types/supabase";

type Anniversary = Database["public"]["Tables"]["anniversaries"]["Row"];

export function useAnniversaries() {
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnniversaries();
      setAnniversaries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (data: AnniversaryInsertData) => {
      const anniversary = await createAnniversary(data);
      await refresh();
      return anniversary;
    },
    [refresh],
  );

  const remove = useCallback(async (id: string) => {
    await deleteAnniversary(id);
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { anniversaries, loading, error, refresh, add, remove };
}
