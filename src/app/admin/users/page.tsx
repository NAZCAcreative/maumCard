"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CreditCard, Search, X } from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  credits: number;
  joined_at: string;
  last_sign_in_at: string | null;
  has_profile: boolean;
};

type Stats = { total: number; with_profile: number; total_credits: number };

function formatDate(s: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // credit modal
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json() as { users?: AdminUser[]; stats?: Stats; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setUsers(data.users ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || u.nickname?.toLowerCase().includes(q);
  });

  const openCredit = (user: AdminUser) => {
    setTarget(user);
    setAmount("");
    setReason("");
    setGrantError(null);
  };

  const closeCredit = () => setTarget(null);

  const grantCredits = async () => {
    if (!target) return;
    const n = parseInt(amount);
    if (!n || isNaN(n)) { setGrantError("숫자를 입력하세요."); return; }
    if (!reason.trim()) { setGrantError("사유를 입력하세요."); return; }
    setGranting(true);
    setGrantError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: target.id, amount: n, reason: reason.trim() }),
      });
      const data = await res.json() as { ok?: boolean; new_credits?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "처리 실패");
      setUsers((prev) => prev.map((u) => u.id === target.id ? { ...u, credits: data.new_credits ?? u.credits } : u));
      closeCredit();
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setGranting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">사용자 관리</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">전체 가입자 목록과 크레딧을 관리합니다.</p>
        </div>
      </header>

      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "전체 가입자", value: stats.total.toLocaleString() },
            { label: "프로필 생성", value: stats.with_profile.toLocaleString() },
            { label: "총 크레딧 잔액", value: stats.total_credits.toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
              <div className="text-2xl font-black text-[#5a240d]">{s.value}</div>
              <div className="mt-1 text-xs font-semibold text-stone-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일 또는 닉네임 검색"
            className="h-10 w-full rounded-md border border-stone-200 pl-9 pr-4 text-sm outline-none focus:border-[#7b310d]"
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-stone-400">{filtered.length}명</span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-stone-400">불러오는 중...</div>
      ) : error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs font-bold text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left">사용자</th>
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-right">크레딧</th>
                <th className="px-4 py-3 text-left">가입일</th>
                <th className="px-4 py-3 text-left">최근 로그인</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-stone-400">검색 결과가 없습니다.</td></tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-stone-900">{user.nickname ?? <span className="text-stone-400">미설정</span>}</div>
                      {!user.has_profile && (
                        <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">프로필 없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{user.email ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-black text-[#5a240d]">{user.credits.toLocaleString()}</span>
                      <span className="ml-0.5 text-xs text-stone-400">C</span>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{formatDate(user.joined_at)}</td>
                    <td className="px-4 py-3 text-stone-400">{formatDate(user.last_sign_in_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openCredit(user)}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs font-bold text-stone-700 hover:border-[#7b310d] hover:text-[#7b310d]"
                      >
                        <CreditCard size={13} />
                        크레딧
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Credit modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-black text-stone-900">크레딧 조정</h2>
                <p className="mt-0.5 text-sm text-stone-500">{target.nickname ?? target.email}</p>
                <p className="mt-1 text-xs font-semibold text-stone-400">
                  현재 잔액: <span className="font-black text-[#5a240d]">{target.credits.toLocaleString()}C</span>
                </p>
              </div>
              <button onClick={closeCredit} className="grid size-8 place-items-center rounded-full hover:bg-stone-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">조정 크레딧 (양수: 지급 / 음수: 차감)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="예: 10 또는 -5"
                  className="h-11 w-full rounded-md border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
                />
              </div>
              <div className="flex gap-2">
                {[10, 30, 50, -10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAmount(String(n))}
                    className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
                      n > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-stone-700">사유</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 이벤트 지급, CS 처리"
                  className="h-11 w-full rounded-md border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
                />
              </div>
              {grantError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{grantError}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={closeCredit} className="h-11 flex-1 rounded-md border border-stone-200 text-sm font-bold text-stone-600">
                  취소
                </button>
                <button
                  onClick={grantCredits}
                  disabled={granting}
                  className="h-11 flex-1 rounded-md bg-[#7b310d] text-sm font-bold text-white disabled:opacity-50"
                >
                  {granting ? "처리 중..." : "적용"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
