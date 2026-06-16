"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw, Save } from "lucide-react";

type PromptTab = "short" | "long" | "hand";

type TabState = {
  prompt: string;
  original: string;
  loaded: boolean;
};

const DEFAULT_SHORT = `This is a Korean emotional greeting card background image. Add handwritten Korean calligraphy (brush calligraphy) text onto this background to create a complete, artistic greeting card. Calligraphy text to write: - Header (upper center area): "{name}님께" large, expressive Korean brush calligraphy, flowing strokes - Body (below header, centered): "{message}" elegant Korean brush calligraphy, multi-line if needed Calligraphy style requirements: - Authentic Korean brush calligraphy style with visible ink brush stroke texture, natural ink flow and slight bleeding at stroke edges - Ink color: deep warm brown-black (#3b1f10) with ink wash variation - Behind the calligraphy area: soft parchment or hanji paper-textured translucent panel - Thin ink brush decorative lines or minimal floral motifs framing the text area - The background scene must remain beautifully visible around the calligraphy panel - Portrait orientation 3:4 ratio, no digital font appearance, must look hand-painted - Korean characters must be perfectly legible and correctly formed - No watermarks, no borders, no UI elements`;

const DEFAULT_LONG = `This is a Korean emotional greeting card background image. Add handwritten Korean calligraphy (brush calligraphy) text onto this background to create a complete, artistic greeting card. Calligraphy text to write: - Header (upper center area): "{name}님께" large, expressive Korean brush calligraphy - Body (centered, multi-line): "{message}" — this is a long heartfelt message; arrange naturally across multiple lines with balanced spacing, breaking at natural phrase boundaries Calligraphy style requirements: - Authentic Korean brush calligraphy style with visible ink brush stroke texture, natural ink flow - Ink color: deep warm brown-black (#3b1f10) with ink wash variation - Font size slightly smaller than short-card variant to accommodate longer text gracefully - Behind the calligraphy area: soft parchment or hanji paper-textured translucent panel, taller to fit all lines - Thin ink brush decorative lines or minimal floral motifs framing the text area - The background scene must remain beautifully visible around the calligraphy panel - Portrait orientation 3:4 ratio, no digital font appearance, must look hand-painted - Korean characters must be perfectly legible and correctly formed — never truncate or omit any character - No watermarks, no borders, no UI elements`;

const DEFAULT_HAND = `This is a Korean emotional greeting card background image.
Create a handwritten letter card with a warm, intimate, hand-written mood.
Calligraphy text to write:
- Header (upper center area): "{name}님께" or the provided recipient label, written in soft Korean brush handwriting
- Body (centered, multi-paragraph): "{message}" handwritten-style Korean text with natural paragraph breaks and a personal letter feel
Style requirements:
- The card should feel like a real handwritten letter placed on premium hanji paper
- Use a calm, intimate composition with enough empty space around the text
- Ink color: deep warm brown-black (#3b1f10) with soft variation
- Add subtle paper texture, a gentle shadow, and minimal decorative edges
- The text area must remain highly legible and emotionally warm
- Portrait orientation 3:4 ratio, no digital font appearance, must look hand-written
- No watermarks, no borders, no UI elements`;

const TAB_META: Record<PromptTab, { label: string; code: string; defaultPrompt: string; help: string }> = {
  short: {
    label: "단문",
    code: "COMPOSE_PROMPT",
    defaultPrompt: DEFAULT_SHORT,
    help: "짧은 문구용 카드 프롬프트입니다.",
  },
  long: {
    label: "장문",
    code: "COMPOSE_PROMPT_LONG",
    defaultPrompt: DEFAULT_LONG,
    help: "긴 문장과 문단 배치를 고려한 카드 프롬프트입니다.",
  },
  hand: {
    label: "손편지",
    code: "COMPOSE_PROMPT_HAND",
    defaultPrompt: DEFAULT_HAND,
    help: "손글씨 편지 느낌의 전용 프롬프트입니다.",
  },
};

export default function PromptAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<PromptTab>("short");
  const [states, setStates] = useState<Record<PromptTab, TabState>>({
    short: { prompt: "", original: "", loaded: false },
    long: { prompt: "", original: "", loaded: false },
    hand: { prompt: "", original: "", loaded: false },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadTab = (target: PromptTab) => {
    const meta = TAB_META[target];
    fetch(`/api/admin/prompt?code=${meta.code}`)
      .then((r) => r.json())
      .then(({ prompt: value, setup_needed }) => {
        const next = value ?? meta.defaultPrompt;
        setStates((prev) => ({ ...prev, [target]: { prompt: next, original: next, loaded: true } }));
        if (setup_needed) {
          setMessage({ type: "err", text: `card_prompt_templates 테이블이 없습니다. ${meta.code}를 실행할 수 없습니다.` });
        }
      })
      .catch(() => {
        setStates((prev) => ({ ...prev, [target]: { prompt: meta.defaultPrompt, original: meta.defaultPrompt, loaded: true } }));
      });
  };

  useEffect(() => {
    loadTab("short");
    loadTab("long");
    loadTab("hand");
  }, []);

  const current = states[tab];
  const currentMeta = TAB_META[tab];
  const setPrompt = (value: string) => {
    setMessage(null);
    setStates((prev) => ({ ...prev, [tab]: { ...prev[tab], prompt: value } }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: current.prompt, code: currentMeta.code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
      setStates((prev) => ({ ...prev, [tab]: { ...prev[tab], original: current.prompt } }));
      setMessage({ type: "ok", text: "저장되었습니다." });
      setTimeout(() => router.push("/admin"), 800);
    } catch (error) {
      setMessage({
        type: "err",
        text: error instanceof Error ? error.message : "저장에 실패했습니다. 다시 시도해주세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMessage(null);
    const def = currentMeta.defaultPrompt;
    setStates((prev) => ({ ...prev, [tab]: { ...prev[tab], prompt: def } }));
  };

  const isDirty = current.prompt !== current.original;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-5 py-6">
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
        <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-[#5a240d]">감성 프롬프트 관리</h1>
          <p className="mt-0.5 text-xs font-semibold text-stone-500">
            카드 생성에 사용하는 단문, 장문, 손편지용 AI 프롬프트를 수정합니다.
          </p>
        </div>
      </header>

      <div className="mb-4 flex gap-2 border-b border-stone-200">
        {(Object.keys(TAB_META) as PromptTab[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setMessage(null);
            }}
            className={`px-5 py-2.5 text-sm font-bold transition ${
              tab === key ? "border-b-2 border-[#7b310d] text-[#7b310d]" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {TAB_META[key].label}
            {states[key].loaded && states[key].prompt !== states[key].original && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
            )}
          </button>
        ))}
      </div>

      <section className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        <p>
          <code className="rounded bg-amber-100 px-1">{`{name}`}</code> = 받는 사람 이름,
          <code className="ml-1 rounded bg-amber-100 px-1">{`{message}`}</code> = 카드 문구
          {tab === "hand" && <span className="ml-2 text-amber-600">손편지는 연애편지 톤과 호칭 문구까지 반영됩니다.</span>}
        </p>
      </section>

      {!current.loaded ? (
        <div className="grid h-64 place-items-center text-sm font-semibold text-stone-400">불러오는 중...</div>
      ) : (
        <>
          <textarea
            value={current.prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-stone-50 p-4 font-mono text-sm leading-7 text-stone-800 outline-none focus:border-[#7b310d] focus:ring-2 focus:ring-[#7b310d]/10"
            rows={22}
            spellCheck={false}
          />

          <div className="mt-2 text-right text-xs font-semibold text-stone-400">{current.prompt.length}자</div>

          {message && (
            <div
              className={`mt-3 rounded-md px-4 py-2.5 text-sm font-bold ${
                message.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={save}
              disabled={saving || !isDirty || !current.prompt.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#7b310d] py-3 font-bold text-white disabled:opacity-40"
            >
              <Save size={16} />
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-md border border-stone-300 px-4 py-3 font-bold text-stone-600 hover:bg-stone-50"
            >
              <RotateCcw size={16} />
              기본값
            </button>
          </div>
        </>
      )}
    </main>
  );
}
