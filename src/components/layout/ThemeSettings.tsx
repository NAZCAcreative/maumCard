"use client";

import { Check, MonitorCog, Palette, X } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeId = "onmaum" | "silver-warm" | "silver-contrast" | "sophisticated" | "youth-mint" | "youth-peach" | "korean-palace" | "gradient-cosmic";

const themes: Array<{
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[];
}> = [
  {
    id: "onmaum",
    name: "온마음 기본",
    description: "새싹 캐릭터의 세이지 그린과 크림, 따뜻한 브라운이 어우러진 기본 테마",
    swatches: ["#7b310d", "#faf6ee", "#7b9a5a"],
  },
  {
    id: "silver-warm",
    name: "큰글씨 온화 모드",
    description: "눈이 편안한 따뜻한 베이지 색상과 큼직한 글씨",
    swatches: ["#8B2522", "#FFFDF9", "#F7EDE2"],
  },
  {
    id: "silver-contrast",
    name: "선명한 고대비 모드",
    description: "노란색/검은색 고대비 화면과 큼직한 글씨",
    swatches: ["#F59E0B", "#090A0C", "#222736"],
  },
  {
    id: "sophisticated",
    name: "세련된 모던 모드",
    description: "미래지향적인 아방가르드 다크 테마와 매끄러운 디자인",
    swatches: ["#8B5CF6", "#09080E", "#1A172E"],
  },
  {
    id: "youth-mint",
    name: "청춘 민트 모드",
    description: "20대를 위한 싱그럽고 청량한 민트초코 감성",
    swatches: ["#10B981", "#F2FBF5", "#D1FAE5"],
  },
  {
    id: "youth-peach",
    name: "네온 피치 모드",
    description: "20대를 위한 에너제틱하고 달콤한 썬셋 피치 감성",
    swatches: ["#FF6B6B", "#FFFBF7", "#FFEDD5"],
  },
  {
    id: "korean-palace",
    name: "한국 고궁 모드",
    description: "청기와 고궁의 청량한 기품과 예스러운 한지 격자 문양",
    swatches: ["#2A6E6B", "#F7F5EE", "#D69F3D"],
  },
  {
    id: "gradient-cosmic",
    name: "우주 그라데이션 모드",
    description: "퍼플, 블루, 핑크, 레드가 어우러진 신비롭고 영롱한 그라데이션 테마",
    swatches: ["#7c3aed", "#2563eb", "#ec4899"],
  },
];

const storageKey = "maumcard:theme";

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((item) => item.id === value);
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

export function ThemePanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<ThemeId>("onmaum");
  const [fontSize, setFontSizeState] = useState<"normal" | "large" | "xlarge">("normal");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial: ThemeId = isThemeId(saved) ? saved : "onmaum";
    setTheme(initial);

    const savedSize = window.localStorage.getItem("maumcard:font-size");
    if (savedSize === "normal" || savedSize === "large" || savedSize === "xlarge") {
      setFontSizeState(savedSize);
    }
  }, []);

  const changeTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  };

  const changeFontSize = (nextSize: "normal" | "large" | "xlarge") => {
    setFontSizeState(nextSize);
    document.documentElement.dataset.fontSize = nextSize;
    window.localStorage.setItem("maumcard:font-size", nextSize);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
      <section className="theme-settings-panel theme-surface w-full max-h-[85vh] flex flex-col rounded-lg border border-outline-variant/30 p-4 shadow-2xl sm:max-w-md">
        {/* Fixed Header */}
        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md theme-muted-surface theme-brand-text">
              <Palette size={18} />
             </span>
             <div>
               <h2 className="font-black">디자인 설정</h2>
               <p className="text-xs font-semibold text-on-surface-variant">화면의 글씨 크기와 테마를 함께 변경합니다.</p>
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
 
         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
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
 
           {/* 글자 크기 설정 */}
           <div className="border-t border-outline-variant/20 pt-4">
             <h3 className="mb-2 text-sm font-black theme-brand-text">글자 크기 설정</h3>
             <div className="grid grid-cols-3 gap-2">
               {([
                 { id: "normal", label: "보통" },
                 { id: "large", label: "크게" },
                 { id: "xlarge", label: "아주 크게" },
               ] as const).map((sizeOpt) => {
                 const active = fontSize === sizeOpt.id;
                 return (
                   <button
                     type="button"
                     key={sizeOpt.id}
                     onClick={() => changeFontSize(sizeOpt.id)}
                     className={`rounded-md border py-2.5 text-center text-sm font-black transition ${
                       active
                         ? "border-[var(--app-brand-border)] theme-brand text-white"
                         : "border-outline-variant/30 text-on-surface hover:bg-surface-container"
                     }`}
                   >
                     {sizeOpt.label}
                   </button>
                 );
               })}
             </div>
           </div>
 
           <div className="flex items-center gap-2 rounded-md theme-muted-surface px-3 py-2 text-xs font-semibold text-on-surface-variant">
             <MonitorCog size={15} />
             <span>바깥 배경과 앱 영역이 선택하신 디자인 모드에 맞춰 최적화됩니다.</span>
           </div>
         </div>
       </section>
     </div>
   );
}

export default function ThemeSettings() {
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial: ThemeId = isThemeId(saved) ? saved : "onmaum";
    applyTheme(initial);

    const savedSize = window.localStorage.getItem("maumcard:font-size");
    const initialSize = (savedSize === "normal" || savedSize === "large" || savedSize === "xlarge") ? savedSize : "normal";
    document.documentElement.dataset.fontSize = initialSize;
  }, []);

  return null;
}

