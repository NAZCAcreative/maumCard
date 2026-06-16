"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Save, Trash2, ToggleLeft, ToggleRight, Upload } from "lucide-react";

type MyCard = {
  id: string;
  message: string;
  card_image_url: string | null;
  created_at: string;
  purpose: string;
};

type HomeCardRow = {
  id: string;
  title: string;
  message: string;
  image_url: string;
  link_href: string;
  cta_label: string;
  is_active: boolean;
  show_title: boolean;
  show_text: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type FormState = {
  title: string;
  message: string;
  image_url: string;
  link_href: string;
  cta_label: string;
  sort_order: string;
  is_active: boolean;
  show_title: boolean;
  show_text: boolean;
};

type ImageTab = "url" | "upload" | "card";

function todayTitle() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `오늘의카드_${mm}${dd}`;
}

function emptyForm(): FormState {
  return {
    title: todayTitle(),
    message: "",
    image_url: "",
    link_href: "/create",
    cta_label: "카드 만들기",
    sort_order: "0",
    is_active: true,
    show_title: true,
    show_text: true,
  };
}

export default function HomeCardsAdminPage() {
  const [items, setItems] = useState<HomeCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const [imageTab, setImageTab] = useState<ImageTab>("url");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/home-cards");
      const data = await res.json() as { cards?: HomeCardRow[]; error?: string; setup_needed?: boolean };
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setItems(data.cards ?? []);
      setSetupNeeded(Boolean(data.setup_needed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMyCards = useCallback(async () => {
    if (cardsLoading || myCards.length > 0) return;
    setCardsLoading(true);
    try {
      const res = await fetch("/api/admin/home-cards?type=cards");
      const data = await res.json() as { cards?: MyCard[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "로드 실패");
      setMyCards(data.cards ?? []);
    } catch {
      setMyCards([]);
    } finally {
      setCardsLoading(false);
    }
  }, [cardsLoading, myCards.length]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setImageTab("url");
  };

  const beginEdit = (item: HomeCardRow) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      message: item.message,
      image_url: item.image_url,
      link_href: item.link_href,
      cta_label: item.cta_label,
      sort_order: String(item.sort_order),
      is_active: item.is_active,
      show_title: item.show_title,
      show_text: item.show_text,
    });
    setImageTab("url");
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/home-cards", { method: "PUT", body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "업로드 실패");
      setForm((prev) => ({ ...prev, image_url: data.url! }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const switchTab = (tab: ImageTab) => {
    setImageTab(tab);
    if (tab === "card") loadMyCards();
  };

  const save = async () => {
    if (!form.image_url.trim()) {
      setError("이미지를 입력/선택해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim() || undefined,
        message: form.message.trim(),
        image_url: form.image_url.trim(),
        link_href: form.link_href.trim() || "/create",
        cta_label: form.cta_label.trim() || "카드 만들기",
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        show_title: form.show_title,
        show_text: form.show_text,
      };
      const res = await fetch("/api/admin/home-cards", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
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

  const toggleActive = async (item: HomeCardRow) => {
    try {
      const res = await fetch("/api/admin/home-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "변경 실패");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "변경 실패");
    }
  };

  const remove = async (item: HomeCardRow) => {
    if (!confirm(`"${item.title}" 카드를 삭제할까요?`)) return;
    try {
      const res = await fetch("/api/admin/home-cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "삭제 실패");
      if (editingId === item.id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const previewTitle = useMemo(() => form.title.trim() || "홈 카드 제목", [form.title]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">메인 카드 관리</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">
            홈 화면의 대표 카드 이미지를 등록하고 순서를 조정합니다.
          </p>
        </div>
      </header>

      {setupNeeded && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          `home_featured_cards` 테이블이 없습니다. `010_home_featured_cards.sql`을 먼저 실행하세요.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-black text-stone-900">{editingId ? "카드 수정" : "카드 등록"}</h2>
            {editingId && (
              <button onClick={resetForm} className="text-xs font-bold text-stone-500 hover:text-stone-800">
                취소
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 flex items-center justify-between text-sm font-bold">
                제목
                <span className="text-[10px] font-semibold text-stone-400">비우면 오늘의카드_날짜 로 저장</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
                placeholder="예: 오늘의 카드"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-sm font-bold">
                문구
                <span className="text-[10px] font-semibold text-stone-400">선택 입력</span>
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                className="min-h-28 w-full rounded-md border border-stone-200 p-4 outline-none focus:border-[#7b310d] leading-6"
                placeholder="홈 카드에 표시할 문구 (선택)"
              />
            </div>

            {/* Image source: 3-tab selector */}
            <div>
              <label className="mb-2 block text-sm font-bold">이미지</label>
              <div className="mb-3 flex overflow-hidden rounded-md border border-stone-200">
                {(["url", "upload", "card"] as ImageTab[]).map((tab) => {
                  const labels = { url: "URL 입력", upload: "파일 업로드", card: "내 카드 선택" };
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => switchTab(tab)}
                      className={`flex-1 py-2 text-xs font-bold transition ${
                        imageTab === tab
                          ? "bg-[#7b310d] text-white"
                          : "bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {imageTab === "url" && (
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                  className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
                  placeholder="https://..."
                />
              )}

              {imageTab === "upload" && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="home-card-file"
                  />
                  <label
                    htmlFor="home-card-file"
                    className={`flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-sm font-semibold transition ${
                      uploadLoading
                        ? "border-stone-200 text-stone-400"
                        : form.image_url
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 text-stone-500 hover:border-[#7b310d] hover:text-[#7b310d]"
                    }`}
                  >
                    {uploadLoading ? (
                      <>업로드 중...</>
                    ) : form.image_url ? (
                      <><span className="text-xl">✓</span>업로드 완료 · 다시 선택하려면 클릭</>
                    ) : (
                      <><Upload size={20} />이미지 파일을 선택하세요</>
                    )}
                  </label>
                </div>
              )}

              {imageTab === "card" && (
                <div>
                  {cardsLoading ? (
                    <div className="py-8 text-center text-sm font-semibold text-stone-400">불러오는 중...</div>
                  ) : myCards.length === 0 ? (
                    <div className="rounded-md border border-dashed border-stone-200 py-8 text-center text-sm font-semibold text-stone-400">
                      이미지가 있는 카드가 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {myCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image_url: card.card_image_url! }))}
                          className={`overflow-hidden rounded-lg border-2 transition ${
                            form.image_url === card.card_image_url
                              ? "border-[#7b310d]"
                              : "border-transparent hover:border-stone-300"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.card_image_url!}
                            alt={card.purpose}
                            className="aspect-[3/4] w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.image_url && (
                <p className="mt-1.5 truncate text-[11px] font-semibold text-stone-400">{form.image_url}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold">버튼 링크</label>
                <input
                  value={form.link_href}
                  onChange={(e) => setForm((prev) => ({ ...prev, link_href: e.target.value }))}
                  className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
                  placeholder="/create"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">버튼 라벨</label>
                <input
                  value={form.cta_label}
                  onChange={(e) => setForm((prev) => ({ ...prev, cta_label: e.target.value }))}
                  className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
                  placeholder="카드 만들기"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold">노출 순서</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  className={`flex h-12 w-full items-center justify-between rounded-md border px-4 text-sm font-bold ${
                    form.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-stone-500"
                  }`}
                >
                  {form.is_active ? "활성" : "비활성"}
                  {form.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-stone-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.show_title}
                  onChange={(e) => setForm((prev) => ({ ...prev, show_title: e.target.checked }))}
                  className="h-4 w-4 accent-[#7b310d]"
                />
                <div>
                  <span className="block text-sm font-bold text-stone-900">이미지에 제목 표시</span>
                  <span className="text-xs font-semibold text-stone-400">이미지 위에 제목 뱃지를 노출합니다</span>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-stone-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.show_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, show_text: e.target.checked }))}
                  className="h-4 w-4 accent-[#7b310d]"
                />
                <div>
                  <span className="block text-sm font-bold text-stone-900">이미지에 문구 표시</span>
                  <span className="text-xs font-semibold text-stone-400">이미지 위에 카드 문구를 노출합니다</span>
                </div>
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-bold text-white disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "저장 중..." : editingId ? "수정 저장" : "등록"}
            </button>

            <div className="rounded-lg border border-dashed border-stone-200 bg-white p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">미리보기</div>
              <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 p-4">
                <div className="mb-3 text-sm font-black text-stone-900">{previewTitle}</div>
                <div className="mb-3 overflow-hidden rounded-lg bg-stone-200">
                  {form.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image_url} alt="preview" className="aspect-[3/4] w-full object-cover object-top" />
                  ) : (
                    <div className="grid aspect-[3/4] place-items-center text-sm font-semibold text-stone-400">
                      이미지를 선택하세요
                    </div>
                  )}
                </div>
                <p className="text-sm leading-6 text-stone-700">{form.message || "홈에 보여줄 카드 문구"}</p>
                <div className="mt-3 inline-flex rounded-full bg-[#7b310d] px-3 py-1 text-xs font-bold text-white">
                  {form.cta_label || "카드 만들기"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-black text-stone-900">등록된 카드</h2>
              <p className="mt-0.5 text-xs font-semibold text-stone-500">
                홈 화면에는 활성 카드 중 순서가 가장 앞선 카드가 노출됩니다.
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
              {items.length}개
            </span>
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center text-sm font-semibold text-stone-400">
              불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-12 text-center text-sm font-semibold text-stone-500">
              등록된 홈 카드가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.title} className="aspect-[3/4] w-full object-cover object-top" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-black text-stone-900">{item.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">{item.message}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-500"}`}>
                          {item.is_active ? "활성" : "비활성"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                          순서 {item.sort_order}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                          {item.cta_label}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                          {item.link_href}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => beginEdit(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                        >
                          <Pencil size={14} />
                          수정
                        </button>
                        <button
                          onClick={() => toggleActive(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                        >
                          {item.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {item.is_active ? "비활성화" : "활성화"}
                        </button>
                        <button
                          onClick={() => remove(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
