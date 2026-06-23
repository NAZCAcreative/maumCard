"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

type InApp = "kakao" | "naver" | "line" | "instagram" | "facebook" | "other" | null;

function detectInApp(ua: string): InApp {
  const s = ua.toLowerCase();
  if (s.includes("kakaotalk")) return "kakao";
  if (s.includes("naver")) return "naver";
  if (s.includes("line/")) return "line";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("fban") || s.includes("fbav") || s.includes("fb_iab")) return "facebook";
  // 안드로이드 일반 웹뷰 휴리스틱
  if (s.includes("; wv)")) return "other";
  return null;
}

/**
 * 인앱 브라우저(카카오톡 등) 감지 안내.
 * 구글 OAuth 는 인앱 웹뷰에서 'disallowed_useragent' 로 차단되므로,
 * 정식 브라우저로 열도록 유도한다. (카카오톡은 외부 열기 스킴 자동 호출)
 */
export function InAppBrowserNotice() {
  const [type, setType] = useState<InApp>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setType(detectInApp(navigator.userAgent));
  }, []);

  if (!type) return null;

  const url = typeof window !== "undefined" ? window.location.href : "";

  const openExternal = () => {
    if (type === "kakao") {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
      return;
    }
    if (/android/i.test(navigator.userAgent)) {
      const noScheme = url.replace(/^https?:\/\//, "");
      window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    // iOS 기타 인앱: 안내 문구로 대체 (자동 외부 열기 스킴 없음)
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const canAutoOpen = type === "kakao" || /android/i.test(navigator.userAgent);

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left">
      <p className="text-sm font-black text-amber-900">인앱 브라우저에서는 구글 로그인이 막혀요</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
        크롬·사파리 같은 기본 브라우저로 열어야 로그인할 수 있어요.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canAutoOpen && (
          <button
            type="button"
            onClick={openExternal}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
          >
            <ExternalLink size={14} /> 외부 브라우저로 열기
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-700"
        >
          {copied ? "링크 복사됨" : "링크 복사"}
        </button>
      </div>
      {!canAutoOpen && (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-amber-700">
          또는 우측 상단 메뉴(⋯)에서 “다른 브라우저로 열기”를 선택하세요.
        </p>
      )}
    </div>
  );
}
