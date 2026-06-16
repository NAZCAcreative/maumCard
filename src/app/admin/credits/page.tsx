"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Save } from "lucide-react";

type Transaction = {
  id: string;
  user_id: string;
  nickname: string | null;
  amount: number;
  reason: string;
  created_at: string;
};

type Summary = { total_charged: number; total_used: number; count: number };

type AdminUser = { id: string; email: string | null; nickname: string | null };

type SystemSettings = { signup_bonus_credits: number; ai_suggestions_enabled: boolean; updated_at: string };

const REASON_PRESETS = ["이벤트 지급", "CS 처리", "환불 보상", "테스트"];

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminCreditsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 시스템 설정
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [bonusInput, setBonusInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/credits?limit=100");
      const data = await res.json() as { transactions?: Transaction[]; summary?: Summary; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setTransactions(data.transactions ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d: { users?: AdminUser[] }) => setUsers(d.users ?? []))
      .catch(() => {});
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { settings?: SystemSettings }) => {
        if (d.settings) {
          setSettings(d.settings);
          setBonusInput(String(d.settings.signup_bonus_credits));
        }
      })
      .catch(() => {});
  }, [load]);

  const saveSettings = async () => {
    const n = parseInt(bonusInput);
    if (isNaN(n) || n < 0) { setSettingsMsg({ ok: false, text: "0 이상의 숫자를 입력하세요." }); return; }
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signup_bonus_credits: n }),
      });
      const data = await res.json() as { settings?: SystemSettings; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "저장 실패");
      setSettings(data.settings ?? null);
      setSettingsMsg({ ok: true, text: `저장 완료 — 신규 가입자 ${n}C 지급` });
    } catch (e) {
      setSettingsMsg({ ok: false, text: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setSavingSettings(false);
    }
  };

  const grant = async () => {
    const n = parseInt(grantAmount);
    if (!grantUserId) { setGrantMsg({ ok: false, text: "사용자를 선택하세요." }); return; }
    if (!n || isNaN(n)) { setGrantMsg({ ok: false, text: "크레딧 수량을 입력하세요." }); return; }
    if (!grantReason.trim()) { setGrantMsg({ ok: false, text: "사유를 입력하세요." }); return; }
    setGranting(true);
    setGrantMsg(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: grantUserId, amount: n, reason: grantReason.trim() }),
      });
      const data = await res.json() as { ok?: boolean; new_credits?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "처리 실패");
      setGrantMsg({ ok: true, text: `완료 — 새 잔액 ${data.new_credits?.toLocaleString()}C` });
      setGrantAmount("");
      setGrantReason("");
      await load();
    } catch (e) {
      setGrantMsg({ ok: false, text: e instanceof Error ? e.message : "처리 실패" });
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
          <h1 className="text-xl font-black text-[#5a240d]">크레딧 / 결제 내역</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">크레딧 거래 내역 조회 및 수동 지급/차감.</p>
        </div>
        <button onClick={load} className="ml-auto grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50">
          <RefreshCw size={16} />
        </button>
      </header>

      {summary && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "총 지급", value: `+${summary.total_charged.toLocaleString()}C`, color: "text-emerald-700" },
            { label: "총 사용", value: `${summary.total_used.toLocaleString()}C`, color: "text-red-600" },
            { label: "조회 건수", value: `${summary.count.toLocaleString()}건`, color: "text-stone-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="mt-1 text-xs font-semibold text-stone-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 시스템 설정 */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="mb-1 font-black text-stone-900">신규 가입 보너스 크레딧</h2>
        <p className="mb-4 text-xs font-semibold text-stone-500">
          회원가입 시 자동으로 지급되는 크레딧 수량입니다. 변경 시 이후 가입자부터 적용됩니다.
          {settings && (
            <span className="ml-2 text-stone-400">마지막 변경: {formatDate(settings.updated_at)}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={999}
              value={bonusInput}
              onChange={(e) => setBonusInput(e.target.value)}
              className="h-11 w-28 rounded-md border border-stone-200 bg-white px-4 text-center text-lg font-black outline-none focus:border-[#7b310d]"
            />
            <span className="text-sm font-bold text-stone-600">C</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setBonusInput(String(n))}
                className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                  bonusInput === String(n)
                    ? "border-[#7b310d] bg-[#7b310d] text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {n}C
              </button>
            ))}
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="flex h-11 items-center gap-2 rounded-md bg-[#7b310d] px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save size={15} />
            {savingSettings ? "저장 중..." : "저장"}
          </button>
        </div>
        {settingsMsg && (
          <div className={`mt-3 rounded-md px-3 py-2 text-xs font-bold ${settingsMsg.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {settingsMsg.text}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Grant form */}
        <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
          <h2 className="mb-4 font-black text-stone-900">크레딧 수동 지급/차감</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">사용자</label>
              <select
                value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
              >
                <option value="">선택하세요</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname ?? u.email ?? u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">크레딧 (양수: 지급 / 음수: 차감)</label>
              <input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="예: 10 또는 -5"
                className="h-11 w-full rounded-md border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[10, 30, 50, 100, -10, -30].map((n) => (
                  <button
                    key={n}
                    onClick={() => setGrantAmount(String(n))}
                    className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                      n > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">사유</label>
              <input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="사유를 입력하세요"
                className="h-11 w-full rounded-md border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REASON_PRESETS.map((r) => (
                  <button key={r} onClick={() => setGrantReason(r)} className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50">
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {grantMsg && (
              <div className={`rounded-md px-3 py-2 text-xs font-bold ${grantMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {grantMsg.text}
              </div>
            )}

            <button
              onClick={grant}
              disabled={granting}
              className="h-11 w-full rounded-md bg-[#7b310d] text-sm font-bold text-white disabled:opacity-50"
            >
              {granting ? "처리 중..." : "적용"}
            </button>
          </div>
        </section>

        {/* Transaction list */}
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 font-black text-stone-900">거래 내역 (최근 100건)</h2>
          {loading ? (
            <div className="py-12 text-center text-sm text-stone-400">불러오는 중...</div>
          ) : error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-stone-100">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-xs font-bold text-stone-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">사용자</th>
                    <th className="px-3 py-2.5 text-right">크레딧</th>
                    <th className="px-3 py-2.5 text-left">사유</th>
                    <th className="px-3 py-2.5 text-left">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {transactions.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-stone-400">내역이 없습니다.</td></tr>
                  ) : transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-stone-50">
                      <td className="px-3 py-2.5 font-semibold text-stone-700">{t.nickname ?? t.user_id.slice(0, 8)}</td>
                      <td className={`px-3 py-2.5 text-right font-black ${t.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500">{t.reason}</td>
                      <td className="px-3 py-2.5 text-xs text-stone-400">{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
