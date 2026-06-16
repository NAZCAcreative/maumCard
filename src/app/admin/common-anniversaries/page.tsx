"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";

type CommonAnniversary = {
  id: string;
  name: string;
  month: number | null;
  day: number | null;
  yearly_dates: Record<string, string>;
  anniversary_type: string;
  memo: string;
  is_active: boolean;
  sort_order: number;
};

type Settings = {
  max_visible: number;
  window_days: number;
};

const emptyForm: CommonAnniversary = {
  id: "",
  name: "",
  month: 1,
  day: 1,
  yearly_dates: {},
  anniversary_type: "other",
  memo: "",
  is_active: true,
  sort_order: 0,
};

export default function AdminCommonAnniversariesPage() {
  const [items, setItems] = useState<CommonAnniversary[]>([]);
  const [settings, setSettings] = useState<Settings>({ max_visible: 3, window_days: 7 });
  const [form, setForm] = useState<CommonAnniversary>(emptyForm);
  const [yearlyText, setYearlyText] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/common-anniversaries");
    const data = await res.json();
    setItems(data.anniversaries ?? []);
    setSettings(data.settings ?? { max_visible: 3, window_days: 7 });
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    await fetch("/api/admin/common-anniversaries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setMessage("메인 노출 설정을 저장했습니다.");
  };

  const saveForm = async () => {
    let yearly_dates: Record<string, string> = {};
    try {
      yearly_dates = JSON.parse(yearlyText || "{}") as Record<string, string>;
    } catch {
      setMessage("연도별 날짜 JSON 형식이 올바르지 않습니다.");
      return;
    }

    const payload = {
      ...form,
      month: Object.keys(yearly_dates).length > 0 ? null : form.month,
      day: Object.keys(yearly_dates).length > 0 ? null : form.day,
      yearly_dates,
    };

    const exists = items.some((item) => item.id === form.id);
    const res = await fetch("/api/admin/common-anniversaries", {
      method: exists ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setMessage(data.error ?? "저장에 실패했습니다.");
      return;
    }
    setForm(emptyForm);
    setYearlyText("{}");
    setMessage("공통 기념일을 저장했습니다.");
    await load();
  };

  const editItem = (item: CommonAnniversary) => {
    setForm(item);
    setYearlyText(JSON.stringify(item.yearly_dates ?? {}, null, 2));
  };

  const deleteItem = async (id: string) => {
    if (!confirm("이 공통 기념일을 삭제할까요?")) return;
    await fetch("/api/admin/common-anniversaries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const toggleActive = async (item: CommonAnniversary) => {
    await fetch("/api/admin/common-anniversaries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    });
    await load();
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-white/95 px-4">
        <Link href="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone-100">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="font-black text-[#5a240d]">공통 기념일 관리</h1>
          <p className="text-xs font-semibold text-stone-500">메인 화면 기념일 노출과 기본 기념일을 관리합니다.</p>
        </div>
      </header>

      <div className="space-y-6 p-4">
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <h2 className="mb-3 font-black">메인 노출 설정</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">
              최대 노출 개수
              <input
                type="number"
                min={1}
                max={12}
                value={settings.max_visible}
                onChange={(e) => setSettings((prev) => ({ ...prev, max_visible: Number(e.target.value) }))}
                className="mt-1 h-11 w-full rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]"
              />
            </label>
            <label className="text-sm font-bold">
              우선 노출 기간
              <input
                type="number"
                min={0}
                max={365}
                value={settings.window_days}
                onChange={(e) => setSettings((prev) => ({ ...prev, window_days: Number(e.target.value) }))}
                className="mt-1 h-11 w-full rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]"
              />
            </label>
          </div>
          <button onClick={saveSettings} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] font-bold text-white">
            <Save size={17} /> 설정 저장
          </button>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-black">기념일 추가/수정</h2>
          <div className="grid gap-3">
            <input value={form.id} onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value.trim() }))} placeholder="ID 예: parents-day" className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]" />
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="기념일 이름" className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]" />
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min={1} max={12} value={form.month ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value ? Number(e.target.value) : null }))} placeholder="월" className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]" />
              <input type="number" min={1} max={31} value={form.day ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value ? Number(e.target.value) : null }))} placeholder="일" className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]" />
              <input type="number" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))} placeholder="정렬" className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]" />
            </div>
            <select value={form.anniversary_type} onChange={(e) => setForm((prev) => ({ ...prev, anniversary_type: e.target.value }))} className="h-11 rounded-lg border border-stone-200 px-3 outline-none focus:border-[#7b310d]">
              <option value="other">기타</option>
              <option value="family">가족</option>
              <option value="love">사랑</option>
              <option value="thanks">감사</option>
              <option value="friendship">친구</option>
              <option value="birthday">생일</option>
              <option value="congrats">축하</option>
            </select>
            <textarea value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} placeholder="메인에 표시할 설명" className="min-h-20 rounded-lg border border-stone-200 p-3 outline-none focus:border-[#7b310d]" />
            <textarea value={yearlyText} onChange={(e) => setYearlyText(e.target.value)} className="min-h-24 rounded-lg border border-stone-200 p-3 font-mono text-xs outline-none focus:border-[#7b310d]" />
            <p className="text-xs font-semibold text-stone-500">음력처럼 매년 양력 날짜가 바뀌는 기념일은 연도별 날짜 JSON을 입력하세요. 예: {"{\"2026\":\"2026-09-25\"}"}</p>
            <button onClick={saveForm} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7b310d] font-bold text-white">
              <Plus size={17} /> 저장
            </button>
          </div>
          {message && <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm font-bold text-[#7b310d]">{message}</p>}
        </section>

        <section className="space-y-2">
          <h2 className="font-black">공통 기념일 목록 ({items.length})</h2>
          {items.map((item) => (
            <article key={item.id} className={`rounded-xl border p-3 ${item.is_active ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-50 text-[#7b310d]"><CalendarDays size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-black">{item.name}</div>
                  <p className="text-xs font-semibold text-stone-500">
                    {item.month && item.day ? `${item.month}월 ${item.day}일` : JSON.stringify(item.yearly_dates)} · {item.memo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => editItem(item)}
                    className="grid h-8 w-8 place-items-center rounded-full text-stone-500 hover:bg-orange-50 hover:text-[#7b310d]"
                    aria-label="기념일 수정"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => toggleActive(item)}
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
                    aria-label="기념일 활성화 토글"
                  >
                    {item.is_active ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="grid h-8 w-8 place-items-center rounded-full text-red-500 hover:bg-red-50" aria-label="기념일 삭제">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
      <BottomNav />
    </div>
  );
}
