"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Plus, Trash2, ToggleLeft, ToggleRight, ImageIcon, Upload, X, Copy, Check } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import { createClient } from "@/lib/supabase/client";

type BgRow = {
  id: string;
  name: string;
  category: string;
  storage_path: string;
  url: string;
  prompt: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

// API 계정(구독/결제) 선택 토글 노출 여부. 운영상 숨김 — 필요 시 true로 변경.
const SHOW_API_MODE_TOGGLE = false;

const CATEGORIES = [
  { id: "home", label: "🏠 홈 대표" },
  { id: "nature", label: "🌿 자연" },
  { id: "season", label: "🌸 계절" },
  { id: "emotion", label: "💞 감성" },
  { id: "city", label: "🏙️ 도시" },
  { id: "abstract", label: "✨ 추상" },
  { id: "pattern", label: "🎨 패턴" },
];

export default function AdminBackgroundsPage() {
  const [list, setList] = useState<BgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ai" | "upload">("upload");
  const [canUseAi, setCanUseAi] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BgRow | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [dupCat, setDupCat] = useState("nature");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("nature");
  const [prompt, setPrompt] = useState("");
  const [apiMode, setApiMode] = useState<"sub" | "pay">("sub");

  // 업로드 상태
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("nature");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backgrounds");
      const data = await res.json() as { backgrounds?: BgRow[]; error?: string };
      if (data.error) throw new Error(data.error);
      setList(data.backgrounds ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCanUseAi((data.user?.email ?? "").toLowerCase() === "dkpark55@gmail.com");
    }).catch(() => setCanUseAi(false));
  }, [supabase]);

  useEffect(() => {
    if (!canUseAi && tab === "ai") setTab("upload");
  }, [canUseAi, tab]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
    if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""));
  };

  const clearFile = () => {
    setUploadFile(null);
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async () => {
    if (!uploadFile || !uploadName.trim()) {
      setError("파일과 이름을 입력해주세요.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("name", uploadName.trim());
      fd.append("category", uploadCategory);
      const res = await fetch("/api/admin/backgrounds", { method: "PUT", body: fd });
      const data = await res.json() as { background?: BgRow; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "업로드 실패");
      setPreview(data.background!);
      setList((prev) => [data.background!, ...prev]);
      setUploadName("");
      setUploadCategory("nature");
      clearFile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError("이름과 프롬프트를 입력해주세요.");
      return;
    }
    setGenerating(true);
    setError(null);
    setProgress(5);

    intervalRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 4, 88));
    }, 800);

    try {
      const res = await fetch("/api/admin/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, prompt: prompt.trim(), api_mode: apiMode }),
      });
      const data = await res.json() as { background?: BgRow; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "생성 실패");

      setProgress(100);
      setPreview(data.background!);
      setList((prev) => [data.background!, ...prev]);
      setName("");
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setGenerating(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const toggleActive = async (bg: BgRow) => {
    await fetch("/api/admin/backgrounds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bg.id, is_active: !bg.is_active }),
    });
    setList((prev) => prev.map((b) => b.id === bg.id ? { ...b, is_active: !b.is_active } : b));
  };

  const changeCategory = async (bg: BgRow, category: string) => {
    await fetch("/api/admin/backgrounds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bg.id, category }),
    });
    setList((prev) => prev.map((b) => b.id === bg.id ? { ...b, category } : b));
    setEditCatId(null);
  };

  const duplicateBg = async (bg: BgRow) => {
    const res = await fetch("/api/admin/backgrounds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bg.id, duplicate_to: dupCat }),
    });
    const data = await res.json() as { background?: BgRow; error?: string };
    if (data.background) {
      setList((prev) => [data.background!, ...prev]);
      setPreview(data.background!);
    }
    setDupId(null);
  };

  const deleteBg = async (bg: BgRow) => {
    if (!confirm(`"${bg.name}" 배경을 삭제할까요?`)) return;
    await fetch("/api/admin/backgrounds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bg.id, storage_path: bg.storage_path }),
    });
    setList((prev) => prev.filter((b) => b.id !== bg.id));
    if (preview?.id === bg.id) setPreview(null);
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white pb-20">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-white/95 px-4">
        <Link href="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone-100">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="font-black text-[#5a240d]">배경 관리</h1>
          <p className="text-xs font-semibold text-stone-500">총 {list.length}개 · 활성 {list.filter(b => b.is_active).length}개</p>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* 등록 폼 */}
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-4">
          {/* 탭 */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1">
            {([["upload", "📁 이미지 업로드"], ["ai", "✨ AI 생성"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(null); }}
                className={`h-9 rounded-lg text-sm font-bold transition ${tab === key ? "bg-white text-[#5a240d] shadow" : "text-stone-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── 업로드 탭 ── */}
          {tab === "upload" && (
            <>
              {/* 드래그&드롭 or 클릭 */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0] ?? null); }}
                className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white py-6 transition hover:border-[#7b310d]"
              >
                {uploadPreviewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadPreviewUrl} alt="preview" className="mx-auto h-40 rounded-lg object-cover shadow" />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="text-stone-400" />
                    <p className="mt-2 text-sm font-bold text-stone-500">클릭 또는 드래그해서 이미지 업로드</p>
                    <p className="text-xs text-stone-400">JPG, PNG, WEBP · 최대 10MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-600">배경 이름</label>
                  <input
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="예: 봄 벚꽃 길"
                    className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-600">카테고리</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
              )}

              <button
                onClick={uploadImage}
                disabled={uploading || !uploadFile || !uploadName.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] font-bold text-white disabled:bg-stone-300"
              >
                {uploading ? <><Loader2 size={18} className="animate-spin" /> 업로드 중...</> : <><Upload size={18} /> 배경 갤러리에 등록</>}
              </button>
            </>
          )}

          {/* ── AI 생성 탭 ── */}
          {tab === "ai" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-600">배경 이름</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 봄 벚꽃 길"
                    className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-600">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#7b310d]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-stone-600">
                  AI 프롬프트 <span className="font-normal text-stone-400">(영문 or 한글)</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`예:\n- Spring cherry blossom petals falling gently, soft pink tones\n- 따뜻한 노을빛 바다, 감성적인 수채화 스타일`}
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#7b310d] leading-6"
                />
              </div>

              {/* API 모드 토글 — 운영상 숨김처리 (apiMode는 기본값 "sub" 유지).
                  다시 노출하려면 SHOW_API_MODE_TOGGLE = true */}
              {SHOW_API_MODE_TOGGLE && (
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2">
                  <span className="text-xs font-bold text-stone-500">API 계정</span>
                  <div className="flex rounded-lg bg-stone-200 p-0.5">
                    {(["sub", "pay"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setApiMode(m)}
                        className={`h-7 rounded-md px-3 text-xs font-bold transition-all ${apiMode === m ? "bg-white text-[#5a240d] shadow" : "text-stone-500"}`}
                      >
                        {m === "sub" ? "구독 계정" : "결제 API"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {generating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-600">
                    <span>OpenAI로 이미지 생성 중...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-200">
                    <div
                      className="h-2 rounded-full bg-[#7b310d] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
              )}

              <button
                onClick={generate}
                disabled={generating || !name.trim() || !prompt.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] font-bold text-white disabled:bg-stone-300"
              >
                {generating ? <><Loader2 size={18} className="animate-spin" /> 생성 중...</> : <><Plus size={18} /> AI로 생성 & 저장</>}
              </button>
            </>
          )}
        </section>

        {/* 미리보기 (최신 생성) */}
        {preview && (
          <section className="rounded-2xl border border-orange-200 bg-orange-50/30 p-4">
            <h3 className="mb-3 text-sm font-black text-[#7b310d]">✨ 방금 생성된 배경</h3>
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.name} className="h-32 w-24 rounded-xl object-cover shadow-md" />
              <div className="flex-1 space-y-1">
                <p className="font-black">{preview.name}</p>
                <p className="text-xs font-semibold text-stone-500">{CATEGORIES.find(c => c.id === preview.category)?.label}</p>
                {preview.prompt && <p className="text-xs text-stone-500 leading-5 line-clamp-3">{preview.prompt}</p>}
              </div>
            </div>
          </section>
        )}

        {/* 배경 목록 */}
        <section>
          <h2 className="mb-3 font-black">저장된 배경 ({list.length})</h2>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-stone-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 gap-2">
              <ImageIcon size={40} />
              <p className="font-semibold">저장된 배경이 없습니다.</p>
              <p className="text-sm">위 폼에서 첫 번째 배경을 생성해보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {list.map((bg) => (
                <div
                  key={bg.id}
                  className={`relative rounded-2xl overflow-hidden border-2 ${bg.is_active ? "border-[#7b310d]" : "border-stone-200 opacity-50"}`}
                >
                  {/* 3:4 비율 이미지 */}
                  <div className="aspect-[3/4] relative bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
                    {/* 오버레이 버튼 */}
                    <div className="absolute inset-0 flex flex-col justify-between p-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => toggleActive(bg)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/80 backdrop-blur-sm"
                          title={bg.is_active ? "비활성화" : "활성화"}
                        >
                          {bg.is_active
                            ? <ToggleRight size={16} className="text-[#7b310d]" />
                            : <ToggleLeft size={16} className="text-stone-400" />
                          }
                        </button>
                        <button
                          onClick={() => { setDupId(bg.id); setDupCat("nature"); setEditCatId(null); }}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/80 backdrop-blur-sm text-blue-600"
                          title="다른 카테고리로 복사"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => deleteBg(bg)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/80 backdrop-blur-sm text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div>
                        {/* 카테고리 수정 */}
                        {editCatId === bg.id ? (
                          <div className="flex gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                            <select
                              defaultValue={bg.category}
                              onChange={(e) => changeCategory(bg, e.target.value)}
                              className="flex-1 rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-stone-800 outline-none"
                              autoFocus
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                            <button onClick={() => setEditCatId(null)} className="grid h-7 w-7 place-items-center rounded-md bg-white/80 text-stone-500">
                              <X size={12} />
                            </button>
                          </div>
                        ) : dupId === bg.id ? (
                          <div className="flex gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={dupCat}
                              onChange={(e) => setDupCat(e.target.value)}
                              className="flex-1 rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-stone-800 outline-none"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                            <button onClick={() => duplicateBg(bg)} className="grid h-7 w-7 place-items-center rounded-md bg-blue-500 text-white">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setDupId(null)} className="grid h-7 w-7 place-items-center rounded-md bg-white/80 text-stone-500">
                              <X size={12} />
                            </button>
                          </div>
                        ) : null}
                        <div
                          className="rounded-lg bg-black/40 backdrop-blur-sm px-2 py-1.5 cursor-pointer"
                          onClick={() => { setEditCatId(editCatId === bg.id ? null : bg.id); setDupId(null); }}
                          title="클릭해서 카테고리 수정"
                        >
                          <p className="text-xs font-black text-white truncate">{bg.name}</p>
                          <p className="text-[10px] text-white/70">
                            {CATEGORIES.find(c => c.id === bg.category)?.label ?? bg.category} ✏️
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </div>
  );
}
