"use client";

import { Check, MonitorCog, Palette, X } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeId = "warm" | "garden" | "night" | "mono";

const themes: Array<{
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
}> = [
  {
    id: "warm",
    name: "따뜻한 카드",
    description: "기본 Warm Bloom",
    swatches: ["#a13d3f", "#f6ebeb", "#ffffff"],
  },
  {
    id: "garden",
    name: "싱그러운 정원",
    description: "그린 포인트",
    swatches: ["#176b4a", "#eaf7ec", "#ffffff"],
  },
  {
    id: "night",
    name: "고요한 밤",
    description: "앱 영역 다크",
    swatches: ["#6d7cff", "#202832", "#181d23"],
  },
  {
    id: "mono",
    name: "미니멀 모노",
    description: "정돈된 무채색",
    swatches: ["#2f3437", "#eeeeea", "#ffffff"],
  },
];

const storageKey = "maumcard:theme";

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((item) => item.id === value);
}

function applyTheme(theme: ThemeId) {
  if (theme === "warm") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export function ThemePanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<ThemeId>("warm");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial: ThemeId = isThemeId(saved) ? saved : "warm";
    setTheme(initial);
  }, []);

  const changeTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
      <section className="theme-surface w-full rounded-lg border border-outline-variant/30 p-4 shadow-2xl sm:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md theme-muted-surface theme-brand-text">
              <Palette size={18} />
            </span>
            <div>
              <h2 className="font-black">디자인 설정</h2>
              <p className="text-xs font-semibold text-on-surface-variant">버튼, 상단바, 하단네비 색을 함께 바꿉니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-container"
            aria-label="디자인 설정 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-2">
          {themes.map((item) => {
            const active = item.id === theme;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => changeTheme(item.id)}
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition ${
                  active ? "border-[var(--app-brand-border)] theme-muted-surface" : "border-outline-variant/30 hover:bg-surface-container"
                }`}
              >
                <span className="flex h-10 w-14 shrink-0 overflow-hidden rounded-md border border-black/5">
                  {item.swatches.map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.name}</span>
                  <span className="block text-xs font-semibold text-on-surface-variant">{item.description}</span>
                </span>
                {active && <Check className="theme-brand-text" size={18} />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md theme-muted-surface px-3 py-2 text-xs font-semibold text-on-surface-variant">
          <MonitorCog size={15} />
          <span>바깥 배경은 밝은 톤으로 고정되고, 앱 영역만 컨셉에 맞춰 바뀝니다.</span>
        </div>
      </section>
    </div>
  );
}

export default function ThemeSettings() {
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial: ThemeId = isThemeId(saved) ? saved : "warm";
    applyTheme(initial);
  }, []);

  return null;
}
