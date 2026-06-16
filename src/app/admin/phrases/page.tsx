"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronUp, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

type Phrase = {
  id: string;
  category: string;
  phrase_type: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const CATEGORIES = [
  { id: "birthday", label: "생일" },
  { id: "love", label: "안부" },
  { id: "health", label: "건강" },
  { id: "thanks", label: "감사" },
  { id: "comfort", label: "위로" },
  { id: "congrats", label: "명절" },
  { id: "morning", label: "아침 인사" },
  { id: "night", label: "저녁 인사" },
  { id: "custom", label: "직접 입력" },
];

const PHRASE_TYPES = [
  { id: "short", label: "단문" },
  { id: "long", label: "장문" },
];

export default function AdminPhrasesPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState("birthday");
  const [selectedType, setSelectedType] = useState("short");
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // AI 추천 설정
  const [aiEnabled, setAiEnabled] = useState(true);
  const [savingAi, setSavingAi] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { settings?: { ai_suggestions_enabled?: boolean } }) => {
        if (typeof d.settings?.ai_suggestions_enabled === "boolean") {
          setAiEnabled(d.settings.ai_suggestions_enabled);
        }
      })
      .catch(() => {});
  }, []);

  const saveAiSetting = async () => {
    setSavingAi(true);
    setAiMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_suggestions_enabled: aiEnabled }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "저장 실패");
      setAiMsg({ ok: true, text: `AI 추천이 ${aiEnabled ? "활성화" : "비활성화"}되었습니다.` });
    } catch (e) {
      setAiMsg({ ok: false, text: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setSavingAi(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/phrases");
      const data = await res.json() as { phrases?: Phrase[]; error?: string; setup_needed?: boolean };
      if (!res.ok) {
        if (data.setup_needed) {
          setError("curated_phrases 테이블이 없습니다. migration 013_curated_phrases.sql 을 실행해 주세요.");
        } else {
          setError(data.error ?? "로드 실패");
        }
        return;
      }
      setPhrases(data.phrases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = phrases
    .filter((p) => p.category === selectedCat && p.phrase_type === selectedType)
    .sort((a, b) => a.sort_order - b.sort_order);

  const startEdit = (p: Phrase) => {
    setEditId(p.id);
    setEditContent(p.content);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/phrases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, content: editContent }),
      });
      const data = await res.json() as { phrase?: Phrase; error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setPhrases((prev) => prev.map((p) => (p.id === editId ? data.phrase! : p)));
      setEditId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Phrase) => {
    try {
      const res = await fetch("/api/admin/phrases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      });
      const data = await res.json() as { phrase?: Phrase; error?: string };
      if (!res.ok) throw new Error(data.error ?? "변경 실패");
      setPhrases((prev) => prev.map((x) => (x.id === p.id ? data.phrase! : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "변경 실패");
    }
  };

  const deletePhrase = async (id: string) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      const res = await fetch("/api/admin/phrases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      setPhrases((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const movePhrase = async (index: number, dir: "up" | "down") => {
    const list = [...filtered];
    const swapIndex = dir === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;

    const a = list[index];
    const b = list[swapIndex];
    const swaps = [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ];

    try {
      const res = await fetch("/api/admin/phrases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swaps }),
      });
      if (!res.ok) throw new Error("순서 변경 실패");
      setPhrases((prev) =>
        prev.map((p) => {
          const swap = swaps.find((s) => s.id === p.id);
          return swap ? { ...p, sort_order: swap.sort_order } : p;
        })
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "순서 변경 실패");
    }
  };

  const addPhrase = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      const maxOrder = filtered.length > 0 ? Math.max(...filtered.map((p) => p.sort_order)) + 10 : 0;
      const res = await fetch("/api/admin/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCat,
          phrase_type: selectedType,
          content: newContent.trim(),
          sort_order: maxOrder,
        }),
      });
      const data = await res.json() as { phrase?: Phrase; error?: string };
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      setPhrases((prev) => [...prev, data.phrase!]);
      setNewContent("");
      setShowAdd(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "추가 실패");
    } finally {
      setAdding(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link
          href="/admin"
          className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">글귀 관리</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">카테고리별 추천 글귀를 추가·수정·정렬합니다.</p>
        </div>
        <button
          onClick={load}
          className="ml-auto grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* AI 추천 설정 */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-black text-stone-800">AI 추천 글귀</p>
          <p className="text-xs font-semibold text-stone-500">
            카드 만들기 화면에서 AI 추천 탭을 사용자에게 노출합니다.
          </p>
        </div>
        {/* 토글 버튼 */}
        <button
          type="button"
          role="switch"
          aria-checked={aiEnabled}
          onClick={() => { setAiEnabled((v) => !v); setAiMsg(null); }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            aiEnabled ? "bg-[#7b310d]" : "bg-stone-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
              aiEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className={`w-7 text-sm font-bold ${aiEnabled ? "text-[#7b310d]" : "text-stone-400"}`}>
          {aiEnabled ? "ON" : "OFF"}
        </span>
        <button
          onClick={saveAiSetting}
          disabled={savingAi}
          className="flex h-9 items-center gap-1.5 rounded-md bg-[#7b310d] px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          <Save size={13} />
          {savingAi ? "저장 중..." : "저장"}
        </button>
        {aiMsg && (
          <span className={`text-xs font-bold ${aiMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {aiMsg.text}
          </span>
        )}
      </div>

      {/* 카테고리 탭 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const count = phrases.filter((p) => p.category === cat.id && p.phrase_type === selectedType).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
                selectedCat === cat.id
                  ? "border-[#7b310d] bg-[#7b310d] text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
              }`}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs ${selectedCat === cat.id ? "text-orange-200" : "text-stone-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 단문/장문 탭 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-0.5 w-fit">
        {PHRASE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={`rounded-md px-5 py-2 text-sm font-bold transition ${
              selectedType === t.id ? "bg-white text-[#7b310d] shadow-sm" : "text-stone-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 추가 버튼 + 폼 */}
      <div className="mb-4">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="flex h-10 items-center gap-2 rounded-md border border-dashed border-stone-300 bg-white px-4 text-sm font-bold text-stone-500 hover:border-[#7b310d] hover:text-[#7b310d]"
          >
            <Plus size={16} />
            글귀 추가
          </button>
        ) : (
          <div className="rounded-xl border border-[#d98238] bg-orange-50 p-4">
            <p className="mb-2 text-xs font-bold text-stone-600">
              새 글귀 — {CATEGORIES.find((c) => c.id === selectedCat)?.label} / {PHRASE_TYPES.find((t) => t.id === selectedType)?.label}
            </p>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="글귀를 입력하세요..."
              className="w-full rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 outline-none focus:border-[#7b310d]"
              rows={selectedType === "long" ? 5 : 3}
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={addPhrase}
                disabled={adding || !newContent.trim()}
                className="rounded-md bg-[#7b310d] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {adding ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewContent(""); }}
                className="rounded-md border border-stone-200 bg-white px-5 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 글귀 목록 */}
      {loading ? (
        <div className="py-10 text-center text-sm font-semibold text-stone-400">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm font-semibold text-stone-400">
          이 카테고리에 글귀가 없습니다. 추가해보세요.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, index) => (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition ${
                p.is_active ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60"
              }`}
            >
              {editId === p.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded-md border border-[#7b310d] bg-white p-3 text-sm leading-6 outline-none"
                    rows={selectedType === "long" ? 5 : 3}
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="rounded-md bg-[#7b310d] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="rounded-md border border-stone-200 px-4 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {/* 순서 변경 버튼 */}
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      onClick={() => movePhrase(index, "up")}
                      disabled={index === 0}
                      className="grid size-6 place-items-center rounded border border-stone-200 bg-white text-stone-400 hover:border-stone-400 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={() => movePhrase(index, "down")}
                      disabled={index === filtered.length - 1}
                      className="grid size-6 place-items-center rounded border border-stone-200 bg-white text-stone-400 hover:border-stone-400 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* 내용 */}
                  <button
                    onClick={() => startEdit(p)}
                    className="flex-1 text-left text-sm leading-6 text-stone-800 hover:text-[#7b310d]"
                  >
                    <span className="mr-2 text-xs font-bold text-stone-400">#{index + 1}</span>
                    {p.content}
                  </button>

                  {/* 액션 버튼 */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                        p.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      {p.is_active ? "활성" : "비활성"}
                    </button>
                    <button
                      onClick={() => deletePhrase(p.id)}
                      className="grid size-7 place-items-center rounded border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs font-semibold text-stone-400">
        총 {filtered.length}개 · 비활성 {filtered.filter((p) => !p.is_active).length}개
      </p>
    </main>
  );
}
