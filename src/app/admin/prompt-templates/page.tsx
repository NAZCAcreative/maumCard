"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus, Save, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Template = {
  id: string;
  code: string;
  purpose: string;
  name: string;
  description: string;
  template: string;
  style: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type FormState = {
  code: string;
  purpose: string;
  name: string;
  description: string;
  template: string;
  style: string;
  is_active: boolean;
  sort_order: string;
};

const PURPOSES = [
  { id: "birthday", label: "🎂 생일" },
  { id: "love", label: "❤️ 안부" },
  { id: "health", label: "🌱 건강" },
  { id: "thanks", label: "🌸 감사" },
  { id: "comfort", label: "🤗 위로" },
  { id: "congrats", label: "🎉 축하" },
  { id: "morning", label: "☀️ 아침" },
  { id: "night", label: "🌙 저녁" },
  { id: "custom", label: "✏️ 기타" },
];

const EMPTY_FORM: FormState = {
  code: "",
  purpose: "birthday",
  name: "",
  description: "",
  template: "",
  style: "",
  is_active: true,
  sort_order: "0",
};

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prompt-templates");
      const data = await res.json() as { templates?: Template[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setTemplates(data.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const beginEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      code: t.code,
      purpose: t.purpose,
      name: t.name,
      description: t.description,
      template: t.template,
      style: t.style,
      is_active: t.is_active,
      sort_order: String(t.sort_order),
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!form.name.trim() || !form.template.trim()) {
      setError("이름과 템플릿 내용은 필수입니다.");
      return;
    }
    if (!editingId && !form.code.trim()) {
      setError("코드는 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = editingId
        ? {
            id: editingId,
            name: form.name.trim(),
            description: form.description.trim(),
            template: form.template.trim(),
            style: form.style.trim(),
            is_active: form.is_active,
            sort_order: Number(form.sort_order) || 0,
          }
        : {
            code: form.code.trim().toUpperCase().replace(/\s+/g, "_"),
            purpose: form.purpose,
            name: form.name.trim(),
            description: form.description.trim(),
            template: form.template.trim(),
            style: form.style.trim(),
            is_active: form.is_active,
            sort_order: Number(form.sort_order) || 0,
          };

      const res = await fetch("/api/admin/prompt-templates", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "저장 실패");
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: Template) => {
    const res = await fetch("/api/admin/prompt-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    });
    if (res.ok) await load();
  };

  const remove = async (t: Template) => {
    if (!confirm(`"${t.name}" 템플릿을 삭제할까요?`)) return;
    await fetch("/api/admin/prompt-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id }),
    });
    if (editingId === t.id) resetForm();
    await load();
  };

  const grouped = PURPOSES.map((p) => ({
    ...p,
    items: templates.filter((t) => t.purpose === p.id),
  })).filter((g) => selectedPurpose === "all" || g.id === selectedPurpose);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">카드 프롬프트 템플릿</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">AI 카드 생성에 사용할 프롬프트 템플릿을 관리합니다.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {/* Form */}
        <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black text-stone-900">{editingId ? "템플릿 수정" : "템플릿 추가"}</h2>
            {editingId && <button onClick={resetForm} className="text-xs font-bold text-stone-500 hover:text-stone-800">취소</button>}
          </div>

          <div className="space-y-3">
            {!editingId && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">코드 (영문 대문자, 고유)</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-white px-4 text-sm font-mono outline-none focus:border-[#7b310d]"
                    placeholder="예: BIRTHDAY_WARM"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">목적</label>
                  <select
                    value={form.purpose}
                    onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
                  >
                    {PURPOSES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-11 w-full rounded-md border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#7b310d]"
                placeholder="예: 따뜻한 꽃 생일 축복"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">설명</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="h-11 w-full rounded-md border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#7b310d]"
                placeholder="이 템플릿에 대한 간단한 설명"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">프롬프트 템플릿</label>
              <textarea
                value={form.template}
                onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))}
                className="min-h-40 w-full rounded-md border border-stone-200 bg-white p-3 font-mono text-xs leading-5 outline-none focus:border-[#7b310d]"
                placeholder="{BASE_SENIOR_CARD} 변수를 사용할 수 있습니다."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-700">스타일 힌트 (영어 키워드)</label>
              <input
                value={form.style}
                onChange={(e) => setForm((p) => ({ ...p, style: e.target.value }))}
                className="h-11 w-full rounded-md border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#7b310d]"
                placeholder="예: soft floral, warm pastel, elegant"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-bold text-stone-700">순서</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
                  className="h-11 w-full rounded-md border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#7b310d]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                  className={`flex h-11 w-28 items-center justify-between rounded-md border px-3 text-sm font-bold ${
                    form.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"
                  }`}
                >
                  {form.is_active ? "활성" : "비활성"}
                  {form.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
              </div>
            </div>

            {error && <div className="rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</div>}

            <button
              onClick={save}
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] text-sm font-bold text-white disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? "저장 중..." : editingId ? "수정 저장" : "추가"}
            </button>
          </div>
        </section>

        {/* List */}
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedPurpose("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${selectedPurpose === "all" ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600"}`}
            >
              전체 ({templates.length})
            </button>
            {PURPOSES.map((p) => {
              const count = templates.filter((t) => t.purpose === p.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPurpose(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${selectedPurpose === p.id ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600"}`}
                >
                  {p.label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-stone-400">불러오는 중...</div>
          ) : grouped.every((g) => g.items.length === 0) ? (
            <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-400">
              <Plus size={24} className="mx-auto mb-2 opacity-40" />
              등록된 템플릿이 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => group.items.length === 0 ? null : (
                <div key={group.id}>
                  <h3 className="mb-2 text-sm font-black text-stone-500">{group.label}</h3>
                  <div className="space-y-2">
                    {group.items.map((t) => (
                      <div key={t.id} className={`rounded-xl border p-4 ${editingId === t.id ? "border-[#7b310d] bg-orange-50" : "border-stone-200 bg-white"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-stone-900">{t.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-500"}`}>
                                {t.is_active ? "활성" : "비활성"}
                              </span>
                            </div>
                            <code className="mt-0.5 block text-[11px] text-stone-400">{t.code}</code>
                            {t.description && <p className="mt-1 text-xs text-stone-500">{t.description}</p>}
                            <div className="mt-2 max-h-20 overflow-hidden rounded-md bg-stone-100 p-2">
                              <pre className="whitespace-pre-wrap text-[10px] leading-4 text-stone-600">{t.template.slice(0, 200)}{t.template.length > 200 ? "..." : ""}</pre>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <button onClick={() => beginEdit(t)} className="grid size-8 place-items-center rounded-md border border-stone-200 hover:bg-stone-50">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => toggleActive(t)} className="grid size-8 place-items-center rounded-md border border-stone-200 hover:bg-stone-50">
                              {t.is_active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                            </button>
                            <button onClick={() => remove(t)} className="grid size-8 place-items-center rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
