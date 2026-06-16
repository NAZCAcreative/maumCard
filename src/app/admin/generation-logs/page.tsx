"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Copy, Check } from "lucide-react";

type Log = {
  id: string;
  card_name: string | null;
  card_message: string | null;
  prompt: string;
  model: string;
  bg: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-stone-200 bg-white text-stone-500 hover:bg-stone-50">
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
    </button>
  );
}

export default function GenerationLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/generation-logs?limit=100&status=${status}`);
      const data = await res.json() as { logs?: Log[]; setup_needed?: boolean; error?: string };
      if (data.setup_needed) {
        setError("generation_logs 테이블이 없습니다. 015_generation_logs.sql을 Supabase에서 실행하세요.");
        setLogs([]);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setLogs(data.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    load(s);
  };

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">AI 생성 로그</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">이미지 합성에 사용된 프롬프트 및 모델 버전 조회</p>
        </div>
        <button onClick={() => load()} className="ml-auto grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50">
          <RefreshCw size={16} />
        </button>
      </header>

      {/* 요약 */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "전체 조회", value: `${logs.length}건`, color: "text-stone-700" },
          { label: "성공", value: `${successCount}건`, color: "text-emerald-700" },
          { label: "실패", value: `${errorCount}건`, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-xs font-semibold text-stone-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="mb-4 flex gap-2">
        {[
          { value: "all", label: "전체" },
          { value: "success", label: "성공" },
          { value: "error", label: "실패" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
              statusFilter === f.value
                ? "border-[#7b310d] bg-[#7b310d] text-white"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 border border-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-stone-400">불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 py-16 text-center text-sm text-stone-400">
          로그가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <article key={log.id} className="rounded-xl border border-stone-200 bg-white">
              {/* 헤더 */}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  log.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                }`}>
                  {log.status === "success" ? "성공" : "실패"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-800">{log.card_name ?? "—"}</span>
                    <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                      {log.model}
                    </span>
                    {log.bg && (
                      <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold text-stone-500">
                        {log.bg}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-stone-500">{log.card_message}</p>
                </div>
                <span className="shrink-0 text-xs text-stone-400">{formatDate(log.created_at)}</span>
              </button>

              {/* 확장: 프롬프트 전체 */}
              {expandedId === log.id && (
                <div className="border-t border-stone-100 px-4 pb-4 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-500">사용된 프롬프트</span>
                    <CopyButton text={log.prompt} />
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-700 whitespace-pre-wrap break-all border border-stone-100">
                    {log.prompt}
                  </pre>
                  {log.error_message && (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 border border-red-100">
                      에러: {log.error_message}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
