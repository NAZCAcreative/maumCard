"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, ShieldCheck, UserCog } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  is_admin: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "총괄관리자",
  admin: "관리자",
  operator: "운영관리자",
  content: "콘텐츠관리자",
  ai: "AI관리자",
  viewer: "조회전용",
  none: "권한없음",
};

export default function AdminRolesPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admin-roles");
      const data = (await res.json()) as { users?: AdminUser[]; allowed_roles?: string[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "불러오기에 실패했습니다.");
      setUsers(data.users ?? []);
      setAllowedRoles(data.allowed_roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRole = async (userId: string, role: string) => {
    setSavingId(userId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/admin-roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "저장에 실패했습니다.");
      setMessage("관리자 권한을 저장했습니다.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6 pb-32">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">관리자 지정</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">총괄관리자만 다른 관리자와 역할을 지정할 수 있습니다.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
          <ShieldCheck size={14} />
          dkpark55 총괄관리자
        </div>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <div className="mb-4 flex items-center gap-2">
          <UserCog size={18} className="text-[#7b310d]" />
          <h2 className="font-black text-stone-900">역할 관리</h2>
        </div>

        {message && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
        {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-stone-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black text-stone-900">{user.email ?? "-"}</div>
                    <div className="mt-1 text-xs font-semibold text-stone-500">
                      현재 역할: <span className="font-black text-[#7b310d]">{ROLE_LABELS[user.role] ?? user.role}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        disabled={savingId === user.id}
                        onClick={() => saveRole(user.id, role)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          user.role === role
                            ? "border-[#7b310d] bg-[#7b310d] text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        } disabled:opacity-40`}
                      >
                        {ROLE_LABELS[role] ?? role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
