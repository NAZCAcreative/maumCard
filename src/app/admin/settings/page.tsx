"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Save, Megaphone, Sparkles, Coins, ToggleLeft, ToggleRight, Feather, FileText } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";

type AdminSettings = {
  signup_bonus_credits: number;
  ai_suggestions_enabled: boolean;
  ai_background_enabled: boolean;
  ai_compose_enabled: boolean;
  announcement_enabled: boolean;
  announcement_title: string;
  announcement_message: string;
  hand_font_round_enabled: boolean;
  hand_font_brush_enabled: boolean;
  hand_font_pen_enabled: boolean;
  hand_paper_enabled: boolean;
  hand_paper_style: string;
  hand_compose_font_size: number;
  hand_viewer_font_size: number;
  updated_at: string;
};

function ToggleButton({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
        checked ? "border-[#7b310d] bg-[#7b310d] text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
      }`}
    >
      <span className="text-sm font-bold">{label}</span>
      {checked ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
    </button>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [bonus, setBonus] = useState("3");
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const [aiBackgroundEnabled, setAiBackgroundEnabled] = useState(false);
  const [aiComposeEnabled, setAiComposeEnabled] = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [handFontRoundEnabled, setHandFontRoundEnabled] = useState(true);
  const [handFontBrushEnabled, setHandFontBrushEnabled] = useState(true);
  const [handFontPenEnabled, setHandFontPenEnabled] = useState(true);
  const [handPaperEnabled, setHandPaperEnabled] = useState(true);
  const [handPaperStyle, setHandPaperStyle] = useState("hanji");
  const [handComposeFontSize, setHandComposeFontSize] = useState(18);
  const [handViewerFontSize, setHandViewerFontSize] = useState(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const data = (await res.json()) as { settings?: AdminSettings; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "설정을 불러오지 못했습니다.");
      const next = data.settings ?? null;
      setSettings(next);
      setBonus(String(next?.signup_bonus_credits ?? 3));
      setAiSuggestionsEnabled(next?.ai_suggestions_enabled ?? true);
      setAiBackgroundEnabled(next?.ai_background_enabled ?? false);
      setAiComposeEnabled(next?.ai_compose_enabled ?? false);
      setAnnouncementEnabled(next?.announcement_enabled ?? false);
      setAnnouncementTitle(next?.announcement_title ?? "");
      setAnnouncementMessage(next?.announcement_message ?? "");
      setHandFontRoundEnabled(next?.hand_font_round_enabled ?? true);
      setHandFontBrushEnabled(next?.hand_font_brush_enabled ?? true);
      setHandFontPenEnabled(next?.hand_font_pen_enabled ?? true);
      setHandPaperEnabled(next?.hand_paper_enabled ?? true);
      setHandPaperStyle(next?.hand_paper_style ?? "hanji");
      setHandComposeFontSize(next?.hand_compose_font_size ?? 18);
      setHandViewerFontSize(next?.hand_viewer_font_size ?? 18);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const parsed = Number.parseInt(bonus, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage({ ok: false, text: "가입 보너스는 0 이상의 숫자여야 합니다." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_bonus_credits: parsed,
          ai_suggestions_enabled: aiSuggestionsEnabled,
          ai_background_enabled: aiBackgroundEnabled,
          ai_compose_enabled: aiComposeEnabled,
          announcement_enabled: announcementEnabled,
          announcement_title: announcementTitle,
          announcement_message: announcementMessage,
          hand_font_round_enabled: handFontRoundEnabled,
          hand_font_brush_enabled: handFontBrushEnabled,
          hand_font_pen_enabled: handFontPenEnabled,
          hand_paper_enabled: handPaperEnabled,
          hand_paper_style: handPaperStyle,
          hand_compose_font_size: handComposeFontSize,
          hand_viewer_font_size: handViewerFontSize,
        }),
      });
      const data = (await res.json()) as { settings?: AdminSettings; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "저장에 실패했습니다.");
      setSettings(data.settings ?? null);
      setBonus(String(data.settings?.signup_bonus_credits ?? parsed));
      setAiSuggestionsEnabled(data.settings?.ai_suggestions_enabled ?? aiSuggestionsEnabled);
      setAiBackgroundEnabled(data.settings?.ai_background_enabled ?? aiBackgroundEnabled);
      setAiComposeEnabled(data.settings?.ai_compose_enabled ?? aiComposeEnabled);
      setAnnouncementEnabled(data.settings?.announcement_enabled ?? announcementEnabled);
      setAnnouncementTitle(data.settings?.announcement_title ?? announcementTitle);
      setAnnouncementMessage(data.settings?.announcement_message ?? announcementMessage);
      setHandFontRoundEnabled(data.settings?.hand_font_round_enabled ?? handFontRoundEnabled);
      setHandFontBrushEnabled(data.settings?.hand_font_brush_enabled ?? handFontBrushEnabled);
      setHandFontPenEnabled(data.settings?.hand_font_pen_enabled ?? handFontPenEnabled);
      setHandPaperEnabled(data.settings?.hand_paper_enabled ?? handPaperEnabled);
      setHandPaperStyle(data.settings?.hand_paper_style ?? handPaperStyle);
      setHandComposeFontSize(data.settings?.hand_compose_font_size ?? handComposeFontSize);
      setHandViewerFontSize(data.settings?.hand_viewer_font_size ?? handViewerFontSize);
      setMessage({ ok: true, text: "설정을 저장했습니다." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6 pb-32">
        <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
          <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-[#5a240d]">운영 설정</h1>
            <p className="mt-0.5 text-xs font-semibold text-stone-500">가입 보너스, 공지 배너, 손편지 글씨체와 편지지 옵션을 관리합니다.</p>
          </div>
          <button onClick={load} className="ml-auto grid size-9 place-items-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50" aria-label="새로고침">
            <RefreshCw size={16} />
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Coins size={18} className="text-[#7b310d]" />
                <h2 className="font-black text-stone-900">가입 보너스 크레딧</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  className="h-11 w-28 rounded-xl border border-stone-200 bg-white px-4 text-center text-lg font-black outline-none focus:border-[#7b310d]"
                />
                <span className="text-sm font-bold text-stone-600">C</span>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 3, 5, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBonus(String(value))}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                        bonus === String(value)
                          ? "border-[#7b310d] bg-[#7b310d] text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {value}C
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-[#7b310d]" />
                <h2 className="font-black text-stone-900">손편지 글씨 크기</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-bold text-stone-700">
                    <span>작성 화면</span>
                    <span>{handComposeFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={24}
                    step={1}
                    value={handComposeFontSize}
                    onChange={(e) => setHandComposeFontSize(Number(e.target.value))}
                    className="w-full accent-[#7b310d]"
                  />
                  <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">손편지 직접 입력과 추천 문구 카드의 기본 글씨 크기를 조정합니다.</p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-bold text-stone-700">
                    <span>뷰어 화면</span>
                    <span>{handViewerFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={26}
                    step={1}
                    value={handViewerFontSize}
                    onChange={(e) => setHandViewerFontSize(Number(e.target.value))}
                    className="w-full accent-[#7b310d]"
                  />
                  <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">보관함에서 손편지를 열어볼 때 보이는 글씨 크기를 따로 조정합니다.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-violet-600" />
                <h2 className="font-black text-stone-900">AI 설정</h2>
              </div>
              <div className="space-y-3">
                <ToggleButton checked={announcementEnabled} onClick={() => setAnnouncementEnabled((v) => !v)} label="공지 배너 활성화" />
                <ToggleButton checked={aiSuggestionsEnabled} onClick={() => setAiSuggestionsEnabled((v) => !v)} label="AI 추천 문구 활성화" />
                <ToggleButton checked={aiBackgroundEnabled} onClick={() => setAiBackgroundEnabled((v) => !v)} label="배경 AI 생성 버튼 노출" />
                <ToggleButton checked={aiComposeEnabled} onClick={() => setAiComposeEnabled((v) => !v)} label="카드 'AI로 만들기' 버튼 노출" />
                <p className="text-xs font-semibold leading-5 text-stone-500">공지 배너와 AI 추천 문구 on/off를 운영에서 바로 바꿉니다.</p>
                <p className="text-xs font-semibold leading-5 text-stone-500">배경 화면의 “✨ AI 생성” 탭과 글귀 화면의 “AI로 만들기” 버튼 노출을 제어합니다. (기본 비활성화)</p>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Feather size={18} className="text-[#7b310d]" />
                <h2 className="font-black text-stone-900">손편지 글씨체</h2>
              </div>
              <div className="grid gap-3">
                <ToggleButton checked={handFontRoundEnabled} onClick={() => setHandFontRoundEnabled((v) => !v)} label="둥근 펜체" />
                <ToggleButton checked={handFontBrushEnabled} onClick={() => setHandFontBrushEnabled((v) => !v)} label="붓글씨" />
                <ToggleButton checked={handFontPenEnabled} onClick={() => setHandFontPenEnabled((v) => !v)} label="얇은 손글씨" />
              </div>
              <p className="mt-3 text-xs font-semibold leading-5 text-stone-500">비활성화한 글씨체는 손편지 화면에서 숨깁니다.</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                <h2 className="font-black text-stone-900">손편지 편지지</h2>
              </div>
              <div className="space-y-3">
                <ToggleButton checked={handPaperEnabled} onClick={() => setHandPaperEnabled((v) => !v)} label="편지지 사용" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["hanji", "한지"],
                    ["paper", "클래식"],
                    ["linen", "린넨"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setHandPaperStyle(value)}
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${
                        handPaperStyle === value ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200 bg-white text-stone-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold leading-5 text-stone-500">손편지 생성 시 편지지 느낌을 바꾸는 기본 스타일입니다.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone size={18} className="text-rose-600" />
                <h2 className="font-black text-stone-900">공지 배너</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">공지 제목</label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="서비스 점검 안내"
                    className="h-11 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">공지 내용</label>
                  <textarea
                    rows={4}
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    placeholder="오늘 밤 23:00~23:30 사이 점검이 진행됩니다."
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#7b310d]"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
            )}
            {message && (
              <div className={`rounded-xl px-4 py-3 text-sm font-bold ${message.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {message.text}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-stone-200 bg-[#7b310d] p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">preview</p>
              <h3 className="mt-2 text-lg font-black">공지 미리보기</h3>
              <div className="mt-4 rounded-xl bg-white/10 p-4">
                <p className="text-sm font-bold">{announcementTitle || "서비스 공지"}</p>
                <p className="mt-2 text-sm leading-6 text-white/85">
                  {announcementMessage || "공지 내용을 입력하면 여기서 바로 확인할 수 있습니다."}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-white/70">
                <span>상태</span>
                <span>{announcementEnabled ? "활성" : "비활성"}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <h3 className="font-black text-stone-900">현재 설정</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-stone-500">가입 보너스</dt>
                  <dd className="font-black text-stone-900">{bonus}C</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-stone-500">공지 배너</dt>
                  <dd className="font-black text-stone-900">{announcementEnabled ? "활성" : "비활성"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-stone-500">손편지 편지지</dt>
                  <dd className="font-black text-stone-900">{handPaperEnabled ? handPaperStyle : "사용 안 함"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-stone-500">마지막 저장</dt>
                  <dd className="text-right font-black text-stone-900">
                    {settings ? new Date(settings.updated_at).toLocaleString("ko-KR") : "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <button
              onClick={save}
              disabled={saving || loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] font-bold text-white disabled:opacity-40"
            >
              <Save size={16} />
              {saving ? "저장 중..." : "설정 저장"}
            </button>
          </aside>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
