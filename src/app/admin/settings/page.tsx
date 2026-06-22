"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Save, Megaphone, Sparkles, Coins, ToggleLeft, ToggleRight, Feather, FlaskConical } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import { CARD_FONTS } from "@/lib/card-fonts";

type AdminSettings = {
  signup_bonus_credits: number;
  ai_suggestions_enabled: boolean;
  ai_background_enabled: boolean;
  ai_compose_enabled: boolean;
  announcement_enabled: boolean;
  announcement_title: string;
  announcement_message: string;
  whitespace_test_enabled: boolean;
  click_effect_bubbles_enabled: boolean;
  click_effect_spring_enabled: boolean;
  enabled_fonts: string[];
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
  const [whitespaceTestEnabled, setWhitespaceTestEnabled] = useState(false);
  const [clickEffectBubblesEnabled, setClickEffectBubblesEnabled] = useState(true);
  const [clickEffectSpringEnabled, setClickEffectSpringEnabled] = useState(true);
  const [enabledFonts, setEnabledFonts] = useState<string[]>([]);
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
      setWhitespaceTestEnabled(next?.whitespace_test_enabled ?? false);
      setClickEffectBubblesEnabled(next?.click_effect_bubbles_enabled ?? true);
      setClickEffectSpringEnabled(next?.click_effect_spring_enabled ?? true);
      setEnabledFonts(next?.enabled_fonts ?? CARD_FONTS.map((f) => f.id));
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
          whitespace_test_enabled: whitespaceTestEnabled,
          click_effect_bubbles_enabled: clickEffectBubblesEnabled,
          click_effect_spring_enabled: clickEffectSpringEnabled,
          enabled_fonts: enabledFonts,
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
      setWhitespaceTestEnabled(data.settings?.whitespace_test_enabled ?? whitespaceTestEnabled);
      setClickEffectBubblesEnabled(data.settings?.click_effect_bubbles_enabled ?? clickEffectBubblesEnabled);
      setClickEffectSpringEnabled(data.settings?.click_effect_spring_enabled ?? clickEffectSpringEnabled);
      setEnabledFonts(data.settings?.enabled_fonts ?? enabledFonts);
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
            <p className="mt-0.5 text-xs font-semibold text-stone-500">가입 보너스, 공지 배너, 카드 글씨체와 효과 옵션을 관리합니다.</p>
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
                <FlaskConical size={18} className="text-sky-600" />
                <h2 className="font-black text-stone-900">테스트 도구</h2>
              </div>
              <div className="space-y-3">
                <ToggleButton checked={whitespaceTestEnabled} onClick={() => setWhitespaceTestEnabled((v) => !v)} label="빈영역 탐지 테스트 노출" />
                <p className="text-xs font-semibold leading-5 text-stone-500">카드 미리보기의 “🔍 빈영역 탐지 테스트” 패널 노출을 제어합니다. (기본 비활성화 = 숨김)</p>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="font-black text-stone-900">버튼 클릭 효과 설정</h2>
              </div>
              <div className="space-y-3">
                <ToggleButton checked={clickEffectBubblesEnabled} onClick={() => setClickEffectBubblesEnabled((v) => !v)} label="상큼한 방울 파티클 효과" />
                <ToggleButton checked={clickEffectSpringEnabled} onClick={() => setClickEffectSpringEnabled((v) => !v)} label="귀여운 용수철 팅김 효과" />
                <p className="text-xs font-semibold leading-5 text-stone-500">버튼 및 링크 클릭 시 재생할 피드백 애니메이션의 활성화 여부를 각각 지정합니다.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Feather size={18} className="text-[#7b310d]" />
                <h2 className="font-black text-stone-900">카드 글씨체 제한 설정</h2>
              </div>
              {/* 각 글씨체를 실제 모양으로 표시하기 위한 @font-face 주입 */}
              <style>{CARD_FONTS.map((f) => `@font-face{font-family:'${f.family}';src:url('/fonts/${f.file}') format('truetype');font-display:swap;}`).join("")}</style>
              <p className="text-xs font-semibold leading-5 text-stone-500 mb-4">
                카드 글귀 및 상세 글씨 편집 메뉴에서 사용자에게 노출할 폰트를 개별 설정합니다. 체크 해제된 폰트는 제작기에서 숨겨집니다.
              </p>
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEnabledFonts(CARD_FONTS.map((f) => f.id))}
                  className="rounded-lg bg-stone-100 hover:bg-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => setEnabledFonts(["pen"])}
                  className="rounded-lg bg-stone-100 hover:bg-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition"
                >
                  전체 해제 (기본 나눔펜만 유지)
                </button>
              </div>
              <div className="space-y-4">
                {(["손글씨", "명조", "고딕", "디자인"] as const).map((group) => (
                  <div key={group} className="space-y-2">
                    <h3 className="text-xs font-black text-stone-400 border-b border-stone-100 pb-1">{group}</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {CARD_FONTS.filter((f) => f.group === group).map((font) => {
                        const isChecked = enabledFonts.includes(font.id);
                        return (
                          <label
                            key={font.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                              isChecked
                                ? "border-orange-200 bg-orange-50/30 text-[#7b310d]"
                                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={font.id === "pen" && isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEnabledFonts((prev) => [...prev, font.id]);
                                } else {
                                  if (font.id !== "pen") {
                                    setEnabledFonts((prev) => prev.filter((id) => id !== font.id));
                                  }
                                }
                              }}
                              className="rounded border-stone-300 text-[#7b310d] focus:ring-[#7b310d] size-3.5"
                            />
                            <span className="truncate text-base leading-tight" style={{ fontFamily: font.family }}>{font.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
