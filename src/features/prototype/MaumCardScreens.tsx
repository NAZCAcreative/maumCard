"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bookmark,
  Cake,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Flower2,
  Folder,
  Heart,
  Home,
  Inbox,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
  User,
  X,
  Mic,
  MicOff,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";
import { saveCard, getMyCards, toggleFavorite as dbToggleFavorite, deleteCard as dbHideCard, hardDeleteCard as dbDeleteCard, deleteAllCards as dbDeleteAllCards, updateCardImageUrl, updateCardGifUrl } from "@/lib/cards";
import { getFavoriteMessages, addFavoriteMessage, deleteFavoriteMessage } from "@/lib/favoriteMessages";
import type { FavoriteMessage } from "@/lib/favoriteMessages";
import { getAnniversaries, createAnniversary, updateAnniversary, deleteAnniversary } from "@/lib/anniversaries";
import type { AnniversaryInsertData } from "@/lib/anniversaries";
import { useAIBackground } from "@/features/card-create/hooks/useAIBackground";
import { CreditBalance } from "@/features/payment/components/CreditBalance";
import { isAdminEmail } from "@/lib/adminAccess";
import { CARD_FONTS } from "@/lib/card-fonts";
import { ThemePanel } from "@/components/layout/ThemeSettings";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { MusicPlayer } from "@/components/ui/MusicPlayer";
import { IntroRedirect } from "@/components/ui/IntroRedirect";
import { generateRetroGif } from "@/lib/retro-gif";
import { GIF_EFFECTS, type GifEffectId } from "@/lib/retro-effect";
import { useSpeechToText } from "@/lib/useSpeechToText";
import type { Database, Json } from "@/types/supabase";
import Image from "next/image";

type Purpose = "birthday" | "love" | "health" | "thanks" | "comfort" | "congrats" | "morning" | "night" | "hand" | "custom";
type CardItem = {
  id: string;
  name: string;
  purpose: Purpose;
  message: string;
  bg: string;
  createdAt: string;
  favorite?: boolean;
  cardImageUrl?: string | null;
  editorState?: Draft;
};
type TextBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};
type Draft = {
  purpose: Purpose | "";
  name: string;
  recipientPreset: string;
  honorific: string;
  message: string;
  bg: string;
  bgFilter?: string; // 배경 사진 필터 (none/bright/insta/bw/vintage)
  handFont: HandFont;
  handTone: HandTone;
  handMode: "recommend" | "direct";
  directMode?: boolean; // 직접입력(명언) 진입 의도 — 재정렬 흐름에서 URL 파라미터 대체
  messageOrigin?: "direct" | "recommend" | "ai";
  title?: string; // 카드 제목 (받는분 대체, 큰 글씨)
  titleFont?: string; // 제목 글씨체 (card-fonts id)
  contentFont?: string; // 내용 글씨체 (card-fonts id)
  footerFont?: string; // 보내는 사람 글씨체
  cardPosition?: "auto" | "top" | "center" | "bottom"; // 글씨 배치
  textBox?: TextBox; // 미리보기에서 직접 선택한 글씨 영역
  titleTextBox?: TextBox;
  contentTextBox?: TextBox;
  footerTextBox?: TextBox;
  titleRotation?: number;
  contentRotation?: number;
  footerRotation?: number;
  titleScale?: number; // 제목 크기 배율 (기본 1)
  contentScale?: number; // 내용 크기 배율 (기본 1)
  footerScale?: number; // 보내는 사람 크기 배율 (기본 1)
  titleColor?: string; // 제목 글자색 ("auto" 또는 hex)
  contentColor?: string; // 내용 글자색 ("auto" 또는 hex)
  footerColor?: string; // 보내는 사람 글자색 ("auto" 또는 hex)
  footer?: string; // 하단 메세지 (내용 아래)
  authorEnabled?: boolean; // 작성자 표시 여부
  author?: string; // 작성자 이름
  contentAlign?: "left" | "center" | "right"; // 본문(BODY) 가로 정렬
  titleBold?: boolean; // 제목 굵게 여부
  contentBold?: boolean; // 내용 굵게 여부
  footerBold?: boolean; // 보내는 사람 굵게 여부
};

type HandFont = "round" | "brush" | "pen";
type HandTone = "general" | "love";
type RecommendationCategory = Exclude<Purpose, "hand"> | "all" | "mine";
type PreviewTextPart = "title" | "content" | "footer";
type PreviewTextMetrics = {
  titleSize: number;
  contentSize: number;
  footerSize: number;
  titleColor: string;
  contentColor: string;
  footerColor: string;
  titleShadow: string;
  contentShadow: string;
};
type DefaultTextBoxes = {
  titleTextBox: TextBox;
  contentTextBox: TextBox;
  footerTextBox: TextBox;
};
type WsRegion = {
  cx: number; cy: number; x0: number; y0: number; x1: number; y1: number;
  band: "top" | "center" | "bottom";
  density: number; emptiness: number; wRatio: number; hRatio: number;
  brightness?: number;
};

const defaultDraft: Draft = {
  purpose: "",
  name: "",
  recipientPreset: "",
  honorific: "에게",
  message: "",
  bg: "flower",
  bgFilter: "none",
  handFont: "round",
  handTone: "general",
  handMode: "recommend",
  titleBold: false,
  contentBold: false,
  footerBold: false,
};

const draftStorageKey = "maumcard:draft";

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeTextBox(a: { x: number; y: number }, b: { x: number; y: number }): TextBox {
  const minSize = 0.08;
  let x0 = Math.min(a.x, b.x);
  let y0 = Math.min(a.y, b.y);
  let x1 = Math.max(a.x, b.x);
  let y1 = Math.max(a.y, b.y);

  if (x1 - x0 < minSize) {
    const cx = (x0 + x1) / 2;
    x0 = clampUnit(cx - minSize / 2);
    x1 = clampUnit(cx + minSize / 2);
  }
  if (y1 - y0 < minSize) {
    const cy = (y0 + y1) / 2;
    y0 = clampUnit(cy - minSize / 2);
    y1 = clampUnit(cy + minSize / 2);
  }

  return { x0, y0, x1, y1 };
}

type TextBoxSizingDraft = Pick<Draft, "message"> &
  Partial<Pick<Draft, "title" | "footer" | "author" | "authorEnabled" | "titleScale" | "contentScale" | "footerScale">>;

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function centeredTextBox(width: number, y0: number, height: number): TextBox {
  const safeWidth = clampRange(width, 0.24, 0.9);
  const x0 = (1 - safeWidth) / 2;
  return { x0, y0, x1: x0 + safeWidth, y1: y0 + height };
}

// 본문(BODY) 우측 가장자리에 우측 정렬해 배치 — footer를 본문 하단 오른쪽에 두기 위함.
function rightAlignedTextBox(width: number, y0: number, height: number, rightEdge: number): TextBox {
  const safeWidth = clampRange(width, 0.24, 0.9);
  const x1 = clampRange(rightEdge, safeWidth + 0.04, 0.96);
  const x0 = x1 - safeWidth;
  return { x0, y0, x1, y1: y0 + height };
}

function getTextLines(text: string, charsPerLine: number) {
  const paragraphs = text.trim().split(/\n+/).filter(Boolean);
  if (!paragraphs.length) return 1;
  return paragraphs.reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0);
}

const CARD_PREVIEW_WIDTH = 1024;
const CARD_PREVIEW_HEIGHT = 1536;
const TEXT_BOX_PAD_X = 8;

function estimateFontPx(kind: PreviewTextPart, text: string, scale = 1) {
  const len = text.replace(/\s/g, "").length;
  if (kind === "title") return clampRange((len <= 6 ? 150 : len <= 12 ? 124 : 104) * scale, 72, 170);
  if (kind === "footer") return clampRange((len <= 14 ? 62 : 52) * scale, 40, 78);
  if (len <= 12) return clampRange(196 * scale, 120, 240);
  if (len <= 24) return clampRange(168 * scale, 100, 210);
  if (len <= 55) return clampRange(124 * scale, 80, 180);
  if (len <= 100) return clampRange(96 * scale, 64, 140);
  return clampRange(72 * scale, 52, 110);
}

function estimateRenderedLines(text: string, fontPx: number, boxWidthRatio: number) {
  const availableWidth = Math.max(80, boxWidthRatio * CARD_PREVIEW_WIDTH - TEXT_BOX_PAD_X * 2);
  const charsPerLine = Math.max(1, Math.floor(availableWidth / (fontPx * 1.02)));
  return getTextLines(text, charsPerLine);
}

function fitInlineContentSize(availW: number, availH: number, text: string, lineHeight = 1.36, scale = 1) {
  const len = text.replace(/\s/g, "").length;
  const max = len <= 12 ? 190 : len <= 24 ? 170 : 150;
  for (let fontSize = max; fontSize >= 48; fontSize -= 2) {
    const lines = getTextLines(text, Math.max(1, Math.floor(availW / (fontSize * 1.02))));
    if (lines * fontSize * lineHeight <= availH) return fontSize * scale;
  }
  return 48 * scale;
}

// 미리보기 기본 폰트 비율 — TITLE/FOOTER는 BODY(본문) 크기를 기준으로 파생한다.
const PREVIEW_TITLE_BODY_RATIO = 1.5;
const PREVIEW_FOOTER_BODY_RATIO = 0.9;
const DEFAULT_FOOTER_SCALE = 1;

function getInlineFontSize(part: PreviewTextPart, availableBox: TextBox, draft: Draft) {
  const typography = getRecommendedTypography(draft);
  const availableWidth = Math.max(180, (availableBox.x1 - availableBox.x0) * CARD_PREVIEW_WIDTH - 24);
  const availableHeight = Math.max(140, (availableBox.y1 - availableBox.y0) * CARD_PREVIEW_HEIGHT - 24);

  // BODY(본문) 기준 크기를 먼저 산출한다.
  const reservedRatio = (draft.title?.trim() ? 0.17 : 0) + (draft.footer?.trim() ? 0.12 : 0);
  const bodyHeight = availableHeight * clampRange(0.76 - reservedRatio, 0.5, 0.76);
  // 본문 자동 핏 크기(배율 미적용)를 기준으로 잡는다.
  const bodyFit = fitInlineContentSize(availableWidth, bodyHeight, draft.message || " ", 1.36, 1);
  // title/footer 는 "권장 본문 크기"만 기준 → 본문(content) 수동 배율을 바꿔도 끌려가지 않음.
  const bodyBaseForOthers = bodyFit * typography.contentScale;
  const bodySize = Math.round(bodyFit * (draft.contentScale ?? typography.contentScale));

  if (part === "content") return bodySize;
  // 기본: TITLE = BODY × 1.5, FOOTER = BODY × 0.9 (각자 수동 배율만 곱함)
  if (part === "footer") return Math.round(bodyBaseForOthers * PREVIEW_FOOTER_BODY_RATIO * (draft.footerScale ?? DEFAULT_FOOTER_SCALE));
  return Math.round(bodyBaseForOthers * PREVIEW_TITLE_BODY_RATIO * (draft.titleScale ?? 1));
}

function insertLineBreakAtCursor() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const lineBreak = document.createElement("br");
  const caretAnchor = document.createTextNode("\u200b");
  range.insertNode(lineBreak);
  lineBreak.after(caretAnchor);
  range.setStartAfter(caretAnchor);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readEditableText(element: HTMLElement) {
  const readChildren = (parent: Node): string => {
    let result = "";
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? "";
        continue;
      }
      if (!(node instanceof HTMLElement)) continue;
      if (node.tagName === "BR") {
        result += "\n";
        continue;
      }
      const isBlock = node.tagName === "DIV" || node.tagName === "P";
      if (isBlock && result && !result.endsWith("\n")) result += "\n";
      result += readChildren(node);
      if (isBlock && node.nextSibling && !result.endsWith("\n")) result += "\n";
    }
    return result;
  };
  return readChildren(element).replace(/\u200b/g, "").replace(/\u00a0/g, " ").replace(/^\n|\n$/g, "");
}

function estimateBoxHeightRatio(kind: PreviewTextPart, text: string, fontPx: number, boxWidthRatio: number) {
  const lineHeight = kind === "content" ? 1.36 : kind === "footer" ? 1.28 : 1.18;
  const lines = estimateRenderedLines(text, fontPx, boxWidthRatio);
  const verticalPadding = kind === "content" ? 18 : kind === "footer" ? 14 : 16;
  const px = lines * fontPx * lineHeight + verticalPadding;
  const min = kind === "content" ? 0.10 : kind === "footer" ? 0.06 : 0.07;
  const max = kind === "content" ? 0.45 : kind === "footer" ? 0.13 : 0.16;
  return clampRange(px / CARD_PREVIEW_HEIGHT, min, max);
}

function getDefaultBoxMetrics(draft?: TextBoxSizingDraft) {
  const title = draft?.title?.trim() ?? "";
  const message = draft?.message.trim() ?? "";
  const footerParts = [
    draft?.footer?.trim(),
    draft?.authorEnabled && draft?.author?.trim() ? draft.author.trim() : "",
  ].filter(Boolean);
  const footer = footerParts.join("\n");
  const recommendedTypography = getRecommendedTypography({ ...defaultDraft, message, title });
  const titleScale = draft?.titleScale ?? recommendedTypography.titleScale;
  const contentScale = draft?.contentScale ?? recommendedTypography.contentScale;

  const titleLen = title.length || 5;
  const contentLen = message.length || 8;
  const footerLen = footer.replace(/\s/g, "").length || 6;

  const titleW = clampRange(0.3 + titleLen * 0.024 * titleScale, 0.38, 0.68);
  const contentW = clampRange(0.60 + Math.min(contentLen, 110) * 0.0032 * contentScale, 0.72, 0.90);
  const footerW = clampRange(0.28 + footerLen * 0.017, 0.36, 0.62);
  const titleH = clampRange(
    estimateBoxHeightRatio("title", title || "TITLE", estimateFontPx("title", title || "TITLE", titleScale), titleW),
    0.075,
    0.16,
  );
  const contentH = estimateBoxHeightRatio("content", message || "BODY", estimateFontPx("content", message || "BODY", contentScale), contentW);
  const footerH = estimateBoxHeightRatio("footer", footer || "FOOTER", estimateFontPx("footer", footer || "FOOTER", draft?.footerScale ?? DEFAULT_FOOTER_SCALE), footerW);

  return { titleH, contentH, footerH, titleW, contentW, footerW };
}

function stackVisibleTextBoxes(startY: number, metrics: ReturnType<typeof getDefaultBoxMetrics>, hasTitle: boolean, hasFooter: boolean): DefaultTextBoxes {
  const titleBodyGap = 0.035;
  const bodyFooterGap = 0.04;
  let y = clampUnit(startY);
  const titleTextBox = centeredTextBox(metrics.titleW, y, metrics.titleH);
  if (hasTitle) y = titleTextBox.y1 + titleBodyGap;

  const contentTextBox = centeredTextBox(metrics.contentW, y, metrics.contentH);
  y = contentTextBox.y1 + bodyFooterGap;

  // footer는 본문(BODY) 하단 오른쪽 — 본문 우측 가장자리에 정렬
  const footerTextBox = rightAlignedTextBox(metrics.footerW, hasFooter ? y : contentTextBox.y1 + bodyFooterGap, metrics.footerH, contentTextBox.x1);
  return { titleTextBox, contentTextBox, footerTextBox };
}

function getDefaultPartTextBox(part: "title" | "content" | "footer", position?: Draft["cardPosition"], draft?: TextBoxSizingDraft): TextBox {
  const boxes = getDefaultPartTextBoxes(position, draft);
  if (part === "title") return boxes.titleTextBox;
  if (part === "footer") return boxes.footerTextBox;
  return boxes.contentTextBox;
}

function getDefaultPartTextBoxes(position?: Draft["cardPosition"], draft?: TextBoxSizingDraft): DefaultTextBoxes {
  const metrics = getDefaultBoxMetrics(draft);
  const titleBodyGap = 0.035;
  const bodyFooterGap = 0.04;
  const hasTitle = Boolean(draft?.title?.trim());
  const hasFooter = Boolean(draft?.footer?.trim() || (draft?.authorEnabled && draft?.author?.trim()));
  if (!hasTitle && !hasFooter) {
    const bodyOnlyHeight = clampRange(metrics.contentH * 1.06, 0.15, 0.52);
    const bodyOnlyWidth = clampRange(metrics.contentW * 1.08, 0.76, 0.92);
    const contentTextBox = centeredTextBox(bodyOnlyWidth, position === "top" ? 0.16 : position === "bottom" ? 0.78 - bodyOnlyHeight : 0.5 - bodyOnlyHeight / 2, bodyOnlyHeight);
    const titleTextBox = centeredTextBox(metrics.titleW, Math.max(0.06, contentTextBox.y0 - titleBodyGap - metrics.titleH), metrics.titleH);
    const footerTextBox = rightAlignedTextBox(metrics.footerW, Math.min(0.92 - metrics.footerH, contentTextBox.y1 + bodyFooterGap), metrics.footerH, contentTextBox.x1);
    return { titleTextBox, contentTextBox, footerTextBox };
  }
  const totalH =
    (hasTitle ? metrics.titleH + titleBodyGap : 0) +
    metrics.contentH +
    (hasFooter ? bodyFooterGap + metrics.footerH : 0);
  if (position === "top") {
    return stackVisibleTextBoxes(0.07, metrics, hasTitle, hasFooter);
  }
  if (position === "bottom") {
    return stackVisibleTextBoxes(Math.max(0.08, 0.9 - totalH), metrics, hasTitle, hasFooter);
  }
  return stackVisibleTextBoxes(Math.max(0.08, 0.5 - totalH / 2), metrics, hasTitle, hasFooter);
}

function applyWhitespaceRegionToBoxes(boxes: DefaultTextBoxes, region: WsRegion | null): DefaultTextBoxes {
  if (!region) return boxes;
  const allBoxes = [boxes.titleTextBox, boxes.contentTextBox, boxes.footerTextBox];
  const groupTop = Math.min(...allBoxes.map((box) => box.y0));
  const groupBottom = Math.max(...allBoxes.map((box) => box.y1));
  const groupLeft = Math.min(...allBoxes.map((box) => box.x0));
  const groupRight = Math.max(...allBoxes.map((box) => box.x1));
  const contentCx = (boxes.contentTextBox.x0 + boxes.contentTextBox.x1) / 2;
  const contentCy = (boxes.contentTextBox.y0 + boxes.contentTextBox.y1) / 2;
  const safeX0 = 0.055;
  const safeX1 = 0.945;
  const safeY0 = 0.06;
  const safeY1 = 0.94;
  const desiredDx = region.cx - contentCx;
  const desiredDy = region.cy - contentCy;
  const dx = clampRange(desiredDx, safeX0 - groupLeft, safeX1 - groupRight);
  const dy = clampRange(desiredDy, safeY0 - groupTop, safeY1 - groupBottom);
  const move = (box: TextBox): TextBox => ({
    x0: box.x0 + dx,
    y0: box.y0 + dy,
    x1: box.x1 + dx,
    y1: box.y1 + dy,
  });
  return {
    titleTextBox: move(boxes.titleTextBox),
    contentTextBox: move(boxes.contentTextBox),
    footerTextBox: move(boxes.footerTextBox),
  };
}

function getRecommendedTypography(draft: Draft) {
  const messageLength = draft.message.trim().length;
  const titleLength = draft.title?.trim().length ?? 0;
  const isShort = messageLength > 0 && messageLength < 28;
  const bodyOnly = !draft.title?.trim() && !draft.footer?.trim() && !(draft.authorEnabled && draft.author?.trim());
  const purpose = draft.purpose || "custom";
  const contentFont =
    bodyOnly ? "gaegubold" :
    messageLength > 90 ? "gaegu" :
    purpose === "hand" ? "pen" :
    purpose === "love" || purpose === "thanks" || purpose === "comfort" ? "pen" :
    purpose === "birthday" || purpose === "congrats" ? "gaegubold" :
    "gaegu";

  return {
    // 기본 폰트: 제목·본문·푸터 세 박스 모두 같은 폰트 사용 (푸터는 본문 폰트 상속)
    titleFont: contentFont,
    contentFont,
    titleScale: titleLength > 12 ? 0.82 : titleLength > 8 ? 0.9 : 1,
    contentScale: bodyOnly && messageLength <= 12 ? 1.08 : bodyOnly && messageLength <= 24 ? 1.04 : bodyOnly && isShort ? 1 : messageLength > 0 && messageLength <= 24 ? 1 : isShort ? 1 : messageLength > 100 ? 0.92 : messageLength > 55 ? 0.96 : 1,
    cardPosition: "auto" as const,
  };
}


const messagesByPurpose: Record<Purpose, string[]> = {
  birthday: [
    "생일을 진심으로 축하합니다. 오늘 하루 누구보다 행복하게 보내세요.",
    "당신이 태어난 오늘이 참 고맙습니다. 오래오래 건강하고 웃어주세요.",
    "새로운 한 해에는 더 많은 기쁨과 따뜻한 순간이 함께하길 바랍니다.",
    "소중한 당신의 생일에 마음 가득 축하를 보냅니다.",
    "오늘만큼은 모든 걱정 내려놓고 사랑받는 하루 보내세요.",
  ],
  love: [
    "오늘도 당신의 하루가 따뜻한 햇살처럼 빛나길 바랍니다.",
    "별일 없이 잘 지내고 있는지 문득 생각났어요. 늘 평안하길 바랍니다.",
    "바쁜 하루 속에서도 잠깐 웃을 수 있는 순간이 찾아오길 바라요.",
    "멀리 있어도 마음은 늘 곁에 있습니다. 오늘도 응원합니다.",
    "당신은 세상에서 가장 소중한 사람입니다. 늘 건강하고 행복하세요.",
  ],
  health: [
    "무엇보다 건강이 제일입니다. 오늘도 몸과 마음을 잘 챙기세요.",
    "천천히 쉬어가도 괜찮습니다. 건강한 하루가 되길 바랍니다.",
    "몸도 마음도 편안해지는 시간이 당신 곁에 머물길 바라요.",
    "따뜻한 밥 잘 챙겨 드시고, 오늘도 무리하지 마세요.",
    "건강한 웃음이 오래도록 함께하길 진심으로 바랍니다.",
  ],
  thanks: [
    "늘 곁에 있어서 고맙습니다. 당신의 마음을 오래 기억하겠습니다.",
    "말로 다 표현하지 못했지만, 언제나 깊이 감사하고 있습니다.",
    "당신이 건네준 따뜻함 덕분에 많은 날을 잘 지나왔습니다.",
    "작은 배려 하나하나가 제게 큰 힘이 되었습니다. 고맙습니다.",
    "고마운 마음을 담아 이 카드를 보냅니다. 늘 행복하세요.",
  ],
  comfort: [
    "힘든 날도 지나가고, 다시 웃는 날이 꼭 찾아올 거예요.",
    "지금 충분히 잘하고 있습니다. 너무 스스로를 몰아붙이지 마세요.",
    "오늘은 잠시 쉬어도 괜찮습니다. 당신의 마음이 먼저입니다.",
    "혼자 견디고 있다고 느껴질 때도, 당신을 응원하는 마음이 있습니다.",
    "천천히 가도 괜찮아요. 결국 따뜻한 날이 다시 올 거예요.",
  ],
  congrats: [
    "풍성한 마음과 따뜻한 웃음이 함께하는 명절 보내세요.",
    "소중한 사람들과 평안하고 넉넉한 시간 보내시길 바랍니다.",
    "멀리서나마 감사와 안부를 전합니다. 건강한 명절 되세요.",
    "가정에 웃음과 평안이 가득하길 진심으로 기원합니다.",
    "오랜만의 쉼 속에서 마음까지 넉넉해지는 명절 보내세요.",
  ],
  morning: [
    "좋은 아침입니다. 오늘 하루도 기분 좋게 시작하시길 바랍니다.",
    "따뜻한 햇살처럼 밝고 편안한 하루가 되길 바라요.",
    "오늘도 작은 기쁨을 많이 만나는 하루 보내세요.",
    "새로운 아침이 당신에게 좋은 소식을 데려오길 바랍니다.",
    "무리하지 말고 천천히, 그래도 기분 좋게 시작해요.",
  ],
  night: [
    "오늘 하루도 수고 많았습니다. 편안한 밤 보내세요.",
    "고단했던 마음을 내려놓고 깊이 쉬는 밤이 되길 바랍니다.",
    "내일은 오늘보다 조금 더 가벼운 하루가 찾아오길 바라요.",
    "따뜻한 꿈 꾸시고, 몸과 마음 모두 편히 쉬세요.",
    "오늘도 잘 버텨낸 당신에게 조용한 응원을 보냅니다.",
  ],
  hand: [
    "오래 마음속에만 두었던 이야기를 이제는 편지로 조심스럽게 전해봅니다. 당신을 떠올릴 때마다 먼저 드는 감정은 감사와 응원입니다. 늘 제 몫보다 더 많은 마음을 내어주고, 힘든 날에도 티 내지 않고 버텨준 당신의 시간이 참 고맙습니다. 오늘 이 편지가 당신의 하루에 작은 쉼표가 되길 바라며, 잠깐이라도 미소가 머물렀으면 좋겠습니다. 아무 말 없이 지나가도 마음은 늘 당신 편입니다.",
    "짧은 인사로는 다 담기지 않는 마음이 있어 이렇게 길게 적어봅니다. 당신은 늘 주변을 먼저 챙기느라 자신을 뒤로 미루곤 했지요. 그래서 저는 오늘만큼은 당신이 먼저 편안했으면 좋겠습니다. 따뜻한 밥 잘 챙겨 드시고, 지친 마음은 잠시 내려두고, 아주 조금은 자신에게도 다정해지길 바랍니다. 당신의 하루가 생각보다 가볍길 바랍니다. 쉬어가는 시간도 꼭 필요하니까요.",
    "당신이 무심히 지나치는 하루에도 저는 자주 고마움을 느낍니다. 말하지 않아도 전해지는 배려, 아무렇지 않게 건네는 다정함, 그리고 묵묵히 자리를 지켜주는 성실함까지 모두 마음에 남아 있습니다. 이 편지가 닿는 순간만큼은 당신이 혼자가 아니라는 걸 기억해 주셨으면 좋겠습니다. 오늘도 수고 많았다는 말을 꼭 전하고 싶습니다. 늘 그랬듯 당신은 충분히 잘하고 있습니다.",
  ],
  custom: [
    "행복은 멀리 있는 것이 아니라, 지금 이 순간을 느끼는 데서 시작된다.",
    "오늘의 나를 만든 것은 어제의 작은 용기들이었다.",
    "좋은 말은 마음을 살리고, 따뜻한 시선은 하루를 바꾼다.",
    "천천히 가도 괜찮다. 중요한 건 멈추지 않는 것이다.",
    "마음이 흔들릴 때일수록, 내가 믿는 가치를 떠올려보자.",
  ],
};

const longMessagesByPurpose: Record<Purpose, string[]> = {
  birthday: [
    "생일을 진심으로 축하합니다.\n\n한 해 한 해가 지날수록 더 많은 것을 이뤄가시고, 더 많은 행복을 누리시길 바랍니다. 오늘 하루만큼은 세상 모든 걱정 내려놓고 스스로를 충분히 사랑해 주세요. 소중한 당신의 생일을 함께 축하할 수 있어서 감사합니다.",
    "태어나주셔서 고맙습니다.\n\n당신이 이 세상에 존재하는 것만으로도 주변이 따뜻해집니다. 오늘 이 날이 앞으로의 365일 중 가장 빛나는 하루가 되길, 그리고 내년 이맘때도 건강하고 환하게 웃고 있길 진심으로 바랍니다.",
    "이 특별한 날, 마음을 다해 축하 인사를 전합니다.\n\n새로운 나이만큼 새로운 기쁨이 찾아오길 바랍니다. 지난 한 해 동안 고생 많으셨고, 앞으로의 시간은 더욱 풍요롭고 행복하길 진심으로 응원합니다.",
  ],
  love: [
    "안녕하세요, 잘 지내고 계신지요.\n\n문득 당신이 생각나 마음을 전합니다. 바쁜 일상 속에서도 잠깐씩 쉬어가며, 좋아하는 것들로 하루를 채워가시길 바랍니다. 멀리서도 늘 응원하고 있다는 것, 기억해 주세요.",
    "오늘 하루는 어떠셨나요.\n\n별다른 이유 없이 그냥 연락하고 싶었습니다. 요즘 많이 바쁘실 텐데, 밥은 잘 챙겨 드시고 계신지요. 잠깐이라도 스스로를 위한 시간을 갖고, 오늘 하루도 편안하게 마무리하시길 바랍니다.",
    "가끔 이렇게 안부를 전하고 싶어집니다.\n\n당신이 어떻게 지내는지, 요즘은 무엇이 즐거운지 궁금해요. 바쁜 하루하루지만 그 속에서도 작은 행복을 발견하시길, 그리고 언제나 건강하시길 바랍니다.",
  ],
  health: [
    "무엇보다 건강이 제일입니다.\n\n요즘 몸은 좀 어떠신가요. 날씨가 변덕스러운 만큼 체온 조절에 신경 써주시고, 식사도 거르지 말고 꼭 챙겨 드세요. 마음까지 평온한 하루하루가 쌓이길 진심으로 바랍니다.",
    "건강한 몸과 마음으로 오래오래 함께하고 싶습니다.\n\n억지로 무언가를 하지 않아도 괜찮으니, 오늘만큼은 충분히 쉬어가세요. 작은 것에 감사하며 천천히, 그렇게 건강한 하루를 쌓아가시길 응원합니다.",
    "몸 관리 잘 하고 계신가요.\n\n무리하지 마시고 몸이 보내는 신호에 귀를 기울여 주세요. 충분한 수면과 따뜻한 식사, 그리고 가끔은 산책도 좋습니다. 건강하고 활기찬 하루가 언제나 함께하길 바랍니다.",
  ],
  thanks: [
    "고맙다는 말을 자주 하지 못해 미안합니다.\n\n당신이 곁에 있어 준 덕분에 많은 날들을 버텨올 수 있었습니다. 작은 배려 하나하나가 제게는 커다란 힘이 되었어요. 이 마음이 닿길 바라며, 진심으로 감사를 전합니다.",
    "말로는 다 표현할 수 없지만, 언제나 감사하게 생각하고 있습니다.\n\n당신이 건네준 따뜻한 말 한마디, 아무렇지 않게 내밀어 준 손길들이 오랫동안 제 기억에 남아 있습니다. 앞으로도 늘 건강하고 행복하시길 바랍니다.",
    "이 카드 한 장에 마음을 담아 보냅니다.\n\n평소에 감사하다는 말을 쉽게 꺼내지 못했지만, 당신이 저에게 얼마나 큰 힘이 되어왔는지 늘 알고 있었습니다. 진심으로, 고맙습니다.",
  ],
  comfort: [
    "지금 많이 힘드시죠.\n\n억지로 괜찮은 척 하지 않아도 됩니다. 울고 싶을 때 울어도 되고, 쉬고 싶을 때 쉬어도 됩니다. 이 시간이 지나면 분명 다시 웃을 날이 찾아올 거예요. 그때까지 저도 곁에 있겠습니다.",
    "아무 말 하지 않아도 괜찮습니다.\n\n그냥 함께 있어 드리고 싶었어요. 지금 이 순간이 얼마나 힘든지 알고 있습니다. 천천히, 한 발씩, 당신의 속도로 걸어가도 충분합니다. 늘 응원하고 있습니다.",
    "힘든 날에는 힘들다고 말해도 괜찮습니다.\n\n모든 것을 혼자 감당하려 하지 않아도 돼요. 지쳐있을 때 기댈 수 있는 사람이 곁에 있다는 것, 잊지 마세요. 당신이 다시 웃는 날이 어서 오길 바랍니다.",
  ],
  congrats: [
    "따뜻한 명절 인사를 전합니다.\n\n바쁜 일상 속에서 오랜만에 소중한 분들과 함께하는 시간이 되길 바랍니다. 가정에 건강과 웃음이 가득하고, 이 명절이 오래도록 따뜻한 기억으로 남길 진심으로 기원합니다.",
    "풍성하고 따뜻한 명절 보내세요.\n\n멀리서나마 온 가족의 건강과 행복을 기원합니다. 지난 한 해 고생 많으셨습니다. 이번 명절만큼은 편안하게 쉬시고, 가까운 분들과 따뜻한 시간 나누시길 바랍니다.",
    "명절을 맞아 안부를 전합니다.\n\n올 한 해도 건강하고 행복하게 지내시길 바랍니다. 가족들과 함께하는 이 시간이 서로에게 큰 힘이 되길, 그리고 내내 좋은 기억만 쌓이길 진심으로 바랍니다.",
  ],
  morning: [
    "좋은 아침입니다.\n\n오늘 하루도 무리하지 말고 천천히 시작하세요. 어제보다 조금 더 편안한 하루가 되길, 그리고 오늘 작은 기쁨을 하나라도 만나게 되길 진심으로 바랍니다. 따뜻한 하루 보내세요.",
    "새로운 하루가 밝았습니다.\n\n커피 한 잔의 여유처럼, 오늘 하루가 잔잔하고 포근하게 흘러가길 바랍니다. 너무 열심히 하려 하지 않아도 괜찮아요. 그냥 오늘을 살아내는 것만으로도 충분합니다.",
    "아침 햇살처럼 따뜻한 하루가 되길 바랍니다.\n\n오늘도 당신만의 속도로 하루를 시작하세요. 서두르지 않아도 되고, 완벽하지 않아도 됩니다. 그냥 오늘의 당신으로 충분합니다.",
  ],
  night: [
    "오늘 하루도 수고 많으셨습니다.\n\n하루 종일 애쓰신 몸과 마음이 충분히 쉴 수 있는 밤이 되길 바랍니다. 잠들기 전 잠깐이라도 오늘 있었던 작은 좋은 일들을 떠올려보세요. 편안한 밤 보내시길 바랍니다.",
    "고단했던 하루가 저물고 있습니다.\n\n오늘도 최선을 다하신 당신, 정말 잘하셨습니다. 이제는 모든 것을 내려놓고 깊은 휴식을 취하세요. 내일은 오늘보다 더 좋은 하루가 찾아올 거예요. 좋은 꿈 꾸세요.",
    "이 밤, 당신이 편안하길 바랍니다.\n\n오늘 하루 어떤 감정을 느끼셨든, 지금 이 순간만큼은 그 모든 것을 내려놓으세요. 따뜻한 밤, 깊은 잠, 그리고 내일의 새로운 시작을 응원합니다.",
  ],
  hand: [
    "오랫동안 전하고 싶었던 마음을 이제야 편지로 적어봅니다.\n\n말로는 자주 하지 못했지만, 당신을 생각할 때마다 늘 감사한 마음이 먼저 떠올랐습니다. 바쁜 하루 속에서도 당신이 건강하고 편안하길 바라며, 힘들 때에는 잠시 쉬어갈 수 있기를 바랍니다. 이 편지가 당신의 마음에 작은 온기가 되길 진심으로 바랍니다. 오늘 하루만큼은 걱정이 조금 줄어들었으면 합니다. 편안히 숨 쉬는 시간도 당신에게 필요합니다.",
    "조금은 긴 글로 마음을 전하고 싶었습니다.\n\n전하지 못한 고마움과 응원을 이 편지에 담아 조심스럽게 보냅니다. 늘 주변을 먼저 챙기느라 자신을 뒤로 미루는 당신이 오늘만큼은 조금 더 편안했으면 좋겠습니다. 당신의 하루가 무리 없이 흘러가고, 웃음이 조금 더 자주 머물기를 응원합니다. 늘 무리하지 말고 몸과 마음을 함께 챙겨주세요. 오늘은 당신이 조금 더 쉬어도 괜찮습니다.",
    "짧은 인사보다 오래 남는 편지를 쓰고 싶었습니다.\n\n당신이 걸어온 시간은 충분히 소중했고, 지금의 당신 역시 정말 잘하고 있습니다. 아무도 알아주지 않는 것 같아도 묵묵히 버텨온 마음을 저는 알고 있습니다. 오늘 이 편지 한 장이 당신에게 따뜻한 쉼표가 되었으면 좋겠습니다. 아주 작은 위로라도 된다면 그걸로 충분합니다. 내일의 당신이 오늘보다 조금 더 가벼워지길 바랍니다.",
  ],
  custom: [
    "좋은 문장은 마음을 다잡아 줍니다.\n\n짧은 말 한 줄이 오늘의 방향이 되기도 하고, 오래 남는 울림이 되기도 합니다. 마음에 닿는 문장을 골라 당신만의 기준으로 삼아보세요.",
    "명언은 누군가의 생각을 빌려와 지금의 나를 비춰보는 거울입니다.\n\n전하고 싶은 마음이 있다면, 그 마음에 맞는 문장을 천천히 골라보세요. 짧지만 깊은 문장은 오래 기억에 남습니다.",
    "때로는 내 생각보다 남의 문장이 더 정확하게 내 마음을 설명합니다.\n\n지금 당신에게 필요한 한 줄을 찾아보세요. 그 문장은 오늘을 버티게 해 주는 작은 힘이 될 수 있습니다.",
  ],
};

const recommendationCategoryLabels: Record<RecommendationCategory, string> = {
  all: "전체",
  mine: "내 문구",
  birthday: "생일",
  love: "안부",
  health: "건강",
  thanks: "감사",
  comfort: "위로",
  congrats: "명절",
  morning: "아침 인사",
  night: "저녁 인사",
  custom: "명언",
};

const recommendationCategoryOrder: RecommendationCategory[] = [
  "all",
  "mine",
  "birthday",
  "love",
  "health",
  "thanks",
  "comfort",
  "congrats",
  "morning",
  "night",
  "custom",
];

function getOrderedRecommendationCategories(anchor: RecommendationCategory) {
  if (anchor === "all") return recommendationCategoryOrder.filter((category) => category !== "all" && category !== "mine");
  if (anchor === "mine") return [];
  // 특정 카테고리 선택 시 해당 카테고리만 노출 (목록 길이 단축)
  return [anchor];
}

function getRecommendedGroups(
  source: Record<Purpose, string[]>,
  anchor: RecommendationCategory,
): Array<{ purpose: Exclude<Purpose, "hand">; label: string; messages: string[] }> {
  return getOrderedRecommendationCategories(anchor)
    .map((purpose) => ({
      purpose,
      label: recommendationCategoryLabels[purpose],
      messages: Array.from(new Set(source[purpose] ?? [])),
    }))
    .filter((group) => group.messages.length > 0);
}

const handMessagesGeneral = Array.from(
  new Set([...messagesByPurpose.hand, ...longMessagesByPurpose.hand]),
);

const handMessagesLove = [
  "어떤 날엔 가만히 생각만 해도 마음이 이상하게 따뜻해집니다. 당신을 좋아하는 마음은 자꾸만 커져서, 안부를 전하는 짧은 말에도 설렘이 섞입니다. 오늘도 당신의 하루가 환하게 웃는 일들로 가득하길 바랍니다. 이런 마음을 전할 수 있어 참 다행입니다.",
  "당신을 떠올리면 늘 조금 빨리 뛰는 마음을 숨길 수가 없습니다. 보고 싶은 마음, 고마운 마음, 좋아하는 마음이 함께 모여 이 편지가 되었습니다. 오늘도 무사히, 그리고 환하게 웃으며 지내고 있기를 바랍니다. 언젠가 이 마음이 당신에게 닿아도 괜찮다면 좋겠습니다.",
  "사실은 자주 보고 싶고, 자주 궁금합니다. 바쁜 하루 중에도 당신의 소식 하나에 마음이 들뜨고, 짧은 대화에도 오래 웃게 됩니다. 이 편지에는 그런 설레는 마음을 조심스럽게 담아 보냅니다. 당신의 오늘이 포근하고, 당신의 밤이 따뜻하길 바랍니다.",
];

const handMessagesByTone: Record<HandTone, string[]> = {
  general: handMessagesGeneral,
  love: handMessagesLove,
};

const handMessageMaxLengthByTone: Record<HandTone, number> = {
  general: 350,
  love: 300,
};

const handFontOptions: Array<{
  id: HandFont;
  label: string;
  sample: string;
  fontFamily: string;
}> = [
  {
    id: "round",
    label: "둥근 펜체",
    sample: "따뜻하고 부드러운 느낌",
    fontFamily: '"Nanum Pen Script","Apple SD Gothic Neo","Segoe Print",cursive',
  },
  {
    id: "brush",
    label: "붓글씨",
    sample: "진심이 묻어나는 느낌",
    fontFamily: '"Nanum Brush Script","Malgun Gothic","Apple SD Gothic Neo",cursive',
  },
  {
    id: "pen",
    label: "얇은 손글씨",
    sample: "담백하고 섬세한 느낌",
    fontFamily: '"Segoe Print","Nanum Pen Script","Apple SD Gothic Neo",cursive',
  },
];

// 손편지 가독성 우선: 손글씨체 대신 나눔고딕(웹폰트 없으면 시스템 고딕 폴백)으로 표시
const HAND_GOTHIC_FONT = '"Nanum Gothic","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

const recipientPresetOptions = ["어머니", "아버지", "친구야", "선생님"];
const honorificOptions = ["에게", "님", "씨", ...recipientPresetOptions];

const backgrounds = [
  { id: "flower", swatch: "from-rose-100 via-orange-50 to-pink-100", mark: "🌸" },
  { id: "mountain", swatch: "from-sky-100 via-emerald-100 to-lime-100", mark: "⛰️" },
  { id: "river", swatch: "from-cyan-100 via-blue-50 to-emerald-100", mark: "🏞️" },
  { id: "sunset", swatch: "from-orange-200 via-amber-100 to-violet-100", mark: "🌅" },
  { id: "sea", swatch: "from-sky-100 via-cyan-100 to-blue-200", mark: "🌊" },
  { id: "hanok", swatch: "from-stone-100 via-orange-50 to-rose-100", mark: "🏯" },
  { id: "spring", swatch: "from-lime-100 via-sky-50 to-rose-100", mark: "🌤️" },
  { id: "autumn", swatch: "from-yellow-100 via-orange-100 to-red-100", mark: "🍂" },
  { id: "winter", swatch: "from-slate-100 via-sky-50 to-blue-100", mark: "❄️" },
  { id: "sakura", swatch: "from-pink-100 via-rose-50 to-fuchsia-100", mark: "🌺" },
  { id: "forest", swatch: "from-emerald-100 via-green-50 to-teal-100", mark: "🌲" },
  { id: "starry", swatch: "from-indigo-200 via-violet-100 to-purple-200", mark: "✨" },
  { id: "aurora", swatch: "from-teal-100 via-cyan-50 to-violet-100", mark: "🌌" },
  { id: "lavender", swatch: "from-purple-100 via-violet-50 to-pink-100", mark: "💜" },
  { id: "cafe", swatch: "from-amber-100 via-stone-50 to-orange-100", mark: "☕" },
  { id: "beach", swatch: "from-yellow-100 via-amber-50 to-cyan-100", mark: "🏖️" },
  { id: "rainbow", swatch: "from-red-100 via-yellow-100 to-blue-100", mark: "🌈" },
  { id: "cherry", swatch: "from-red-100 via-pink-50 to-rose-200", mark: "🍒" },
  { id: "bamboo", swatch: "from-green-100 via-emerald-50 to-lime-100", mark: "🎋" },
  { id: "cosmos", swatch: "from-violet-200 via-indigo-100 to-blue-200", mark: "🪐" },
  { id: "maple", swatch: "from-red-200 via-orange-100 to-yellow-100", mark: "🍁" },
  { id: "snow", swatch: "from-blue-50 via-slate-50 to-sky-100", mark: "⛄" },
  { id: "garden", swatch: "from-green-50 via-rose-50 to-lime-100", mark: "🌷" },
  { id: "rain", swatch: "from-slate-100 via-blue-50 to-gray-100", mark: "🌧️" },
  { id: "morning_light", swatch: "from-amber-50 via-yellow-50 to-orange-100", mark: "🌄" },
  { id: "night_city", swatch: "from-gray-800 via-slate-700 to-indigo-900", mark: "🌃" },
  { id: "peach", swatch: "from-orange-50 via-rose-50 to-pink-50", mark: "🍑" },
  { id: "ocean_deep", swatch: "from-blue-200 via-cyan-100 to-teal-200", mark: "🐚" },
  { id: "gold", swatch: "from-yellow-100 via-amber-100 to-yellow-200", mark: "🌟" },
  { id: "mint", swatch: "from-teal-50 via-green-50 to-cyan-100", mark: "🌿" },
  { id: "cosmic", swatch: "from-blue-100 via-purple-100 via-pink-100 to-red-100", mark: "🌌" },
];

const defaultCards: CardItem[] = [
  {
    id: "sample-1",
    name: "문주",
    purpose: "love",
    message: "당신을 응원합니다. 오늘도 행복하세요.",
    bg: "flower",
    createdAt: "2026.05.14",
    favorite: true,
  },
  {
    id: "sample-2",
    name: "어머니",
    purpose: "birthday",
    message: "세상에서 가장 따뜻한 분, 늘 건강하고 행복하세요.",
    bg: "spring",
    createdAt: "2026.05.13",
  },
];


function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function useDraft() {
  const [draft, setDraftState] = useState<Draft>(defaultDraft);
  const latestDraftRef = useRef<Draft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedDraft = { ...defaultDraft, ...readJson<Draft>(draftStorageKey, defaultDraft) };
    latestDraftRef.current = storedDraft;
    setDraftState(storedDraft);
    setHydrated(true);
  }, []);

  const setDraft = useCallback((next: Partial<Draft>) => {
    const value = { ...latestDraftRef.current, ...next };
    latestDraftRef.current = value;
    writeJson(draftStorageKey, value);
    setDraftState(value);
  }, []);

  const resetDraft = useCallback(() => {
    latestDraftRef.current = defaultDraft;
    setDraftState(defaultDraft);
    writeJson(draftStorageKey, defaultDraft);
  }, []);

  return [draft, setDraft, hydrated, resetDraft] as const;
}

type DbCard = Database["public"]["Tables"]["card_library"]["Row"];

function mapDbCard(dbCard: DbCard): CardItem {
  const images = readJson<Record<string, string>>("maumcard:card-images", {});
  const savedEditorStates = readJson<Record<string, Draft>>("maumcard:card-editor-states", {});
  let editorState: Draft | undefined = dbCard.editor_state && typeof dbCard.editor_state === "object" && !Array.isArray(dbCard.editor_state)
    ? dbCard.editor_state as unknown as Draft
    : savedEditorStates[dbCard.id];
  if (!editorState && dbCard.compose_mode?.startsWith("editor:")) {
    try {
      editorState = JSON.parse(dbCard.compose_mode.slice(7)) as Draft;
    } catch {
      editorState = undefined;
    }
  }
  return {
    id: dbCard.id,
    name: dbCard.recipient,
    purpose: dbCard.purpose as Purpose,
    message: dbCard.message,
    bg: dbCard.background_id,
    createdAt: new Date(dbCard.created_at).toLocaleDateString("ko-KR").replace(/\.$/, ""),
    favorite: dbCard.is_favorite,
    cardImageUrl: dbCard.card_image_url ?? images[dbCard.id] ?? null,
    editorState,
  };
}

function useFavMessages() {
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getFavoriteMessages();
      setFavorites(data);
    } catch {
      /* not logged in */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (text: string, purpose?: string) => {
    await addFavoriteMessage(text, purpose);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteFavoriteMessage(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isSaved = useCallback((text: string) => favorites.some((f) => f.text === text), [favorites]);

  const toggle = useCallback(async (text: string, purpose?: string) => {
    const existing = favorites.find((f) => f.text === text);
    if (existing) {
      await remove(existing.id);
    } else {
      await add(text, purpose);
    }
  }, [favorites, add, remove]);

  return { favorites, loading, add, remove, isSaved, toggle };
}

function useSupabaseCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    const localCards = readJson<CardItem[]>("maumcard:cards", []);
    try {
      const data = await getMyCards();
      const remoteCards = data.map(mapDbCard);
      const remoteIds = new Set(remoteCards.map((card) => card.id));
      setCards([...localCards.filter((card) => !remoteIds.has(card.id)), ...remoteCards]);
    } catch {
      if (!loadedRef.current) setCards(localCards.length > 0 ? localCards : defaultCards);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updateComposedImage = useCallback(async (cardId: string | null, composedImageBlob: Blob): Promise<string | null> => {
    if (!cardId || cardId.startsWith("sample-")) return null;

    if (cardId.startsWith("local-")) {
      const localUrl = URL.createObjectURL(composedImageBlob);
      const local = readJson<CardItem[]>("maumcard:cards", []);
      writeJson("maumcard:cards", local.map((c) => (c.id === cardId ? { ...c, cardImageUrl: localUrl } : c)));
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, cardImageUrl: localUrl } : c)));
      return localUrl;
    }

    const supabase = createClient();
    const fileName = `cards/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadError } = await supabase.storage
      .from("card-images")
      .upload(fileName, composedImageBlob, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(fileName);
    await updateCardImageUrl(cardId, publicUrl);
    const images = readJson<Record<string, string>>("maumcard:card-images", {});
    writeJson("maumcard:card-images", { ...images, [cardId]: publicUrl });
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, cardImageUrl: publicUrl } : c)));
    return publicUrl;
  }, []);

  const addCard = useCallback(async (draft: Draft, composedImageBlob?: Blob | null): Promise<string | null> => {
    // 보관함 제목 = 미리보기 제목(없으면 내용 일부)
    const cardTitle = draft.title?.trim() || draft.name?.trim() || draft.message?.trim().slice(0, 12) || "무제";
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) {
      // 미로그인 상태 — localStorage에 임시 저장 후 로컬 ID 반환
      const localId = `local-${Date.now()}`;
      const localCard: CardItem = {
        id: localId,
        name: cardTitle,
        purpose: (draft.purpose || "love") as Purpose,
        message: draft.message,
        bg: draft.bg,
        createdAt: new Date().toLocaleDateString("ko-KR").replace(/\.$/, ""),
      };
      if (composedImageBlob) {
        localCard.cardImageUrl = URL.createObjectURL(composedImageBlob);
      }
      localCard.editorState = { ...draft };
      const existing = readJson<CardItem[]>("maumcard:cards", []);
      writeJson("maumcard:cards", [localCard, ...existing]);
      setCards((prev) => [localCard, ...prev]);
      return localId;
    }

    if (!composedImageBlob) {
      throw new Error("완성된 카드 이미지가 없습니다.");
    }

    const fileName = `${user.id}/cards/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadError } = await supabase.storage
      .from("card-images")
      .upload(fileName, composedImageBlob, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(fileName);
    const card = await saveCard({
      purpose: draft.purpose || "love",
      recipient: cardTitle,
      honorific: draft.honorific || "에게",
      message: draft.message,
      background_id: draft.bg,
      is_ai_bg: draft.bg.startsWith("ai:"),
      card_image_url: publicUrl,
      editor_state: { ...draft } as unknown as Json,
    });
    const savedComposeMode = typeof card.compose_mode === "string" ? card.compose_mode : "";
    const savedEditorState = savedComposeMode.startsWith("editor:")
      ? JSON.parse(savedComposeMode.slice(7)) as Draft
      : null;
    if (
      card.message !== draft.message
      || card.recipient !== cardTitle
      || card.card_image_url !== publicUrl
      || savedEditorState?.title !== draft.title
      || savedEditorState?.footer !== draft.footer
    ) {
      throw new Error("저장된 카드 정보 검증에 실패했습니다.");
    }

    const images = readJson<Record<string, string>>("maumcard:card-images", {});
    const editorStates = readJson<Record<string, Draft>>("maumcard:card-editor-states", {});
    writeJson("maumcard:card-images", { ...images, [card.id]: publicUrl });
    writeJson("maumcard:card-editor-states", { ...editorStates, [card.id]: { ...draft } });
    await refresh();
    setCards((prev) => prev.map((item) => item.id === card.id ? { ...item, cardImageUrl: publicUrl } : item));
    return card.id;
  }, [refresh]);

  const toggleFav = useCallback(async (cardId: string, isFavorite: boolean) => {
    try {
      await dbToggleFavorite(cardId, isFavorite);
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, favorite: isFavorite } : c));
    } catch (error) {
      console.error("즐겨찾기 변경 실패:", error);
    }
  }, []);

  const hideCard = useCallback(async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    const local = readJson<CardItem[]>("maumcard:cards", []);
    writeJson("maumcard:cards", local.filter((c) => c.id !== cardId));
    if (!cardId.startsWith("local-") && !cardId.startsWith("sample-")) {
      await dbHideCard(cardId).catch((e) => console.error("카드 숨김 실패:", e));
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    const local = readJson<CardItem[]>("maumcard:cards", []);
    writeJson("maumcard:cards", local.filter((c) => c.id !== cardId));
    if (!cardId.startsWith("local-") && !cardId.startsWith("sample-")) {
      await dbDeleteCard(cardId).catch((e) => console.error("카드 삭제 실패:", e));
    }
  }, []);

  const deleteAll = useCallback(async () => {
    setCards([]);
    writeJson("maumcard:cards", []);
    await dbDeleteAllCards().catch((e) => console.error("전체 삭제 실패:", e));
  }, []);

  return { cards, loading, addCard, updateComposedImage, toggleFav, hideCard, deleteCard, deleteAll };
}

type AnnivItem = Database["public"]["Tables"]["anniversaries"]["Row"];

function useSupabaseAnniversaries() {
  const [items, setItems] = useState<AnnivItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await getAnniversaries();
      setItems(data);
    } catch {
      // not logged in or DB not configured
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (data: AnniversaryInsertData) => {
    await createAnniversary(data);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: string, data: AnniversaryInsertData) => {
    await updateAnniversary({ id, ...data });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteAnniversary(id);
    setItems((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { items, refresh, add, update, remove };
}

type PublicUiSettings = {
  ai_background_enabled: boolean;
  ai_compose_enabled: boolean;
  hand_font_round_enabled: boolean;
  hand_font_brush_enabled: boolean;
  hand_font_pen_enabled: boolean;
  hand_paper_enabled: boolean;
  hand_paper_style: string;
  hand_compose_font_size: number;
  hand_viewer_font_size: number;
  whitespace_test_enabled: boolean;
  enabled_fonts?: string[];
};

function usePublicUiSettings() {
  const [settings, setSettings] = useState<PublicUiSettings>({
    ai_background_enabled: false,
    ai_compose_enabled: false,
    hand_font_round_enabled: true,
    hand_font_brush_enabled: true,
    hand_font_pen_enabled: true,
    hand_paper_enabled: true,
    hand_paper_style: "hanji",
    hand_compose_font_size: 18,
    hand_viewer_font_size: 18,
    whitespace_test_enabled: false,
    enabled_fonts: undefined,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Partial<PublicUiSettings>) => {
        setSettings((prev) => ({
          ai_background_enabled: typeof d.ai_background_enabled === "boolean" ? d.ai_background_enabled : prev.ai_background_enabled,
          ai_compose_enabled: typeof d.ai_compose_enabled === "boolean" ? d.ai_compose_enabled : prev.ai_compose_enabled,
          hand_font_round_enabled: typeof d.hand_font_round_enabled === "boolean" ? d.hand_font_round_enabled : prev.hand_font_round_enabled,
          hand_font_brush_enabled: typeof d.hand_font_brush_enabled === "boolean" ? d.hand_font_brush_enabled : prev.hand_font_brush_enabled,
          hand_font_pen_enabled: typeof d.hand_font_pen_enabled === "boolean" ? d.hand_font_pen_enabled : prev.hand_font_pen_enabled,
          hand_paper_enabled: typeof d.hand_paper_enabled === "boolean" ? d.hand_paper_enabled : prev.hand_paper_enabled,
          hand_paper_style: typeof d.hand_paper_style === "string" && d.hand_paper_style.trim() ? d.hand_paper_style : prev.hand_paper_style,
          hand_compose_font_size: typeof d.hand_compose_font_size === "number" ? d.hand_compose_font_size : prev.hand_compose_font_size,
          hand_viewer_font_size: typeof d.hand_viewer_font_size === "number" ? d.hand_viewer_font_size : prev.hand_viewer_font_size,
          whitespace_test_enabled: typeof d.whitespace_test_enabled === "boolean" ? d.whitespace_test_enabled : prev.whitespace_test_enabled,
          enabled_fonts: Array.isArray(d.enabled_fonts) ? d.enabled_fonts : prev.enabled_fonts,
        }));
      })
      .catch(() => {});
  }, []);

  return settings;
}

type AuthUser = {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  credits: number;
};

type CreditTransaction = Database["public"]["Tables"]["credit_transactions"]["Row"];

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const loadProfile = useCallback(async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    const supabase = supabaseRef.current;
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, credits")
      .eq("id", authUser.id)
      .single();

    setUser({
      id: authUser.id,
      email: authUser.email ?? null,
      nickname: profile?.nickname ?? (typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null) ?? "마음이",
      avatarUrl: profile?.avatar_url ?? (typeof authUser.user_metadata?.avatar_url === "string" ? authUser.user_metadata.avatar_url : null),
      credits: profile?.credits ?? 0,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = supabaseRef.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) {
        setUser(null);
        return;
      }
      await loadProfile(authUser);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    load();
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      loadProfile(session.user)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, [load, loadProfile]);

  return { user, loading, refresh: load };
}

function useCreditTransactions() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransactions(data ?? []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { transactions, loading, refresh };
}

function Avatar({ url, nickname, size = 40 }: { url: string | null; nickname: string; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nickname}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-full bg-orange-100 font-bold text-[#7b310d]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {nickname[0]}
    </div>
  );
}

function Header({ title, backHref }: { title?: string; backHref?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-stone-200 bg-white/95 px-5 sm:h-[68px] sm:px-4">
        {backHref ? (
          <Link href={backHref} aria-label="뒤로가기" className="grid h-12 w-12 place-items-center sm:h-10 sm:w-10">
            <ChevronLeft size={28} />
          </Link>
        ) : (
          <button type="button" aria-label="뒤로가기" onClick={() => router.back()} className="grid h-12 w-12 place-items-center sm:h-10 sm:w-10">
            <ChevronLeft size={28} />
          </button>
        )}
        <div className="text-center">
          <SmoothImage src="/logo/logo_onmaum_01.png" alt="ON마음" className="mx-auto h-8 w-auto sm:h-7" />
          <div className="mt-1 text-sm font-semibold text-stone-600 sm:text-[11px]">{title ?? "마음을 전하는 감성 메시지"}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 sm:h-9 sm:w-9"
            aria-label="디자인 설정"
          >
            <Settings size={22} />
          </button>
          <Link href="/mypage" aria-label="마이페이지" className="grid h-11 w-11 place-items-center sm:h-9 sm:w-9">
            {user
              ? <Avatar url={user.avatarUrl} nickname={user.nickname} size={34} />
              : <User size={20} className="text-stone-500" />
            }
          </Link>
        </div>
      </header>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
    </>
  );
}

function PhoneShell({
  children,
  title,
  backHref,
  hideHeader = false,
}: {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  hideHeader?: boolean;
}) {
  return (
    <main className="app-shell min-h-screen w-full max-w-none text-stone-950 sm:mx-auto sm:max-w-2xl sm:shadow-[0_0_0_1px_rgba(28,25,23,0.06)] lg:max-w-5xl">
      {!hideHeader && <Header title={title} backHref={backHref} />}
      <div className={`cute-page-enter ${hideHeader ? "pb-28 sm:pb-24" : "px-5 pb-28 pt-6 sm:px-6 sm:pb-24 sm:pt-5 lg:px-8"}`}>{children}</div>
    </main>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-14 w-full rounded-xl bg-[#7b310d] px-5 py-3.5 text-center text-lg font-bold text-white shadow-sm transition active:scale-[0.99] disabled:bg-stone-300 sm:min-h-0 sm:rounded-md sm:px-4 sm:py-3 sm:text-base ${props.className ?? ""}`}
    />
  );
}

function CardArt({ card }: { card: Pick<CardItem, "name" | "message" | "bg" | "cardImageUrl"> }) {
  // If we have the actual composed card image, show it directly
  if (card.cardImageUrl) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg bg-stone-200">
        <SmoothImage
          src={card.cardImageUrl}
          alt={`${card.name}에게 보내는 카드`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const bg = backgrounds.find((item) => item.id === card.bg) ?? backgrounds[0];
  const isImageBg =
    card.bg.startsWith("ai:") ||
    card.bg.startsWith("https://") ||
    card.bg.startsWith("http://") ||
    card.bg.startsWith("data:");
  const imageUrl = card.bg.startsWith("ai:") ? card.bg.slice(3) : isImageBg ? card.bg : null;

  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg ${!imageUrl ? `bg-gradient-to-br ${bg.swatch}` : "bg-stone-200"}`}>
      {imageUrl ? (
        <SmoothImage
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <>
          <div className="absolute -left-6 bottom-12 text-[110px] opacity-40">{bg.mark}</div>
          <div className="absolute -right-4 top-10 text-[90px] opacity-50">{bg.mark}</div>
        </>
      )}
    </div>
  );
}

type DefaultAnniversary = {
  id: string;
  name: string;
  month?: number;
  day?: number;
  yearlyDates?: Record<number, string>;
  anniversary_type: string;
  memo: string;
  is_active?: boolean;
  sort_order?: number;
};

type CommonAnniversarySetting = {
  max_visible: number;
  window_days: number;
};

const KOREAN_DEFAULT_ANNIVERSARIES: DefaultAnniversary[] = [
  { id: "new-year", name: "신정", month: 1, day: 1, anniversary_type: "other", memo: "새해 인사를 전하기 좋은 날" },
  { id: "seollal", name: "설날", yearlyDates: { 2026: "2026-02-17", 2027: "2027-02-06" }, anniversary_type: "family", memo: "가족에게 새해 인사를 전하세요" },
  { id: "daeboreum", name: "정월대보름", yearlyDates: { 2026: "2026-03-03", 2027: "2027-02-21" }, anniversary_type: "other", memo: "한 해의 건강과 안녕을 기원하는 날" },
  { id: "valentine", name: "밸런타인데이", month: 2, day: 14, anniversary_type: "love", memo: "좋아하는 마음을 전하세요" },
  { id: "independence", name: "삼일절", month: 3, day: 1, anniversary_type: "other", memo: "나라를 생각하는 기념일" },
  { id: "white-day", name: "화이트데이", month: 3, day: 14, anniversary_type: "love", memo: "고마운 마음을 달콤하게 전하세요" },
  { id: "arbor-day", name: "식목일", month: 4, day: 5, anniversary_type: "other", memo: "봄의 마음을 나누기 좋은 날" },
  { id: "black-day", name: "블랙데이", month: 4, day: 14, anniversary_type: "friendship", memo: "혼자여도 괜찮다는 응원을 보내세요" },
  { id: "labor-day", name: "근로자의 날", month: 5, day: 1, anniversary_type: "thanks", memo: "수고한 사람에게 고마움을 전하세요" },
  { id: "children-day", name: "어린이날", month: 5, day: 5, anniversary_type: "family", memo: "아이에게 사랑과 응원을 전하세요" },
  { id: "parents-day", name: "어버이날", month: 5, day: 8, anniversary_type: "family", memo: "부모님께 감사 인사를 전하세요" },
  { id: "buddha", name: "부처님오신날", yearlyDates: { 2026: "2026-05-24", 2027: "2027-05-13" }, anniversary_type: "other", memo: "평온한 마음을 나누는 날" },
  { id: "teacher-day", name: "스승의 날", month: 5, day: 15, anniversary_type: "thanks", memo: "선생님께 감사의 마음을 전하세요" },
  { id: "adult-day", name: "성년의 날", yearlyDates: { 2026: "2026-05-18", 2027: "2027-05-17" }, anniversary_type: "congrats", memo: "새로운 시작을 축하하세요" },
  { id: "dano", name: "단오", yearlyDates: { 2026: "2026-06-19", 2027: "2027-06-09" }, anniversary_type: "other", memo: "여름을 맞는 전통 명절" },
  { id: "memorial-day", name: "현충일", month: 6, day: 6, anniversary_type: "other", memo: "감사와 추모의 마음을 전하세요" },
  { id: "korean-war", name: "6.25 전쟁일", month: 6, day: 25, anniversary_type: "other", memo: "기억과 평화를 생각하는 날" },
  { id: "constitution", name: "제헌절", month: 7, day: 17, anniversary_type: "other", memo: "대한민국 헌법을 기념하는 날" },
  { id: "chilseok", name: "칠석", yearlyDates: { 2026: "2026-08-19", 2027: "2027-08-08" }, anniversary_type: "love", memo: "견우와 직녀의 마음을 떠올리는 날" },
  { id: "liberation", name: "광복절", month: 8, day: 15, anniversary_type: "other", memo: "광복의 의미를 기억하는 날" },
  { id: "chuseok", name: "추석", yearlyDates: { 2026: "2026-09-25", 2027: "2027-09-14" }, anniversary_type: "family", memo: "가족과 풍요를 나누는 명절" },
  { id: "armed-forces", name: "국군의 날", month: 10, day: 1, anniversary_type: "other", memo: "헌신에 감사하는 날" },
  { id: "foundation", name: "개천절", month: 10, day: 3, anniversary_type: "other", memo: "하늘이 열린 날을 기념하세요" },
  { id: "hangul", name: "한글날", month: 10, day: 9, anniversary_type: "other", memo: "우리말과 글의 소중함을 나누는 날" },
  { id: "halloween", name: "핼러윈", month: 10, day: 31, anniversary_type: "friendship", memo: "가볍고 즐거운 안부를 전하세요" },
  { id: "pepero", name: "빼빼로데이", month: 11, day: 11, anniversary_type: "friendship", memo: "친구와 연인에게 마음을 전하세요" },
  { id: "farmers", name: "농업인의 날", month: 11, day: 11, anniversary_type: "thanks", memo: "수확과 먹거리에 감사하는 날" },
  { id: "martyrs", name: "순국선열의 날", month: 11, day: 17, anniversary_type: "other", memo: "헌신을 기억하는 날" },
  { id: "dongji", name: "동지", yearlyDates: { 2026: "2026-12-22", 2027: "2027-12-22" }, anniversary_type: "other", memo: "긴 밤을 지나 새 기운을 맞는 날" },
  { id: "christmas-eve", name: "크리스마스 이브", month: 12, day: 24, anniversary_type: "love", memo: "따뜻한 안부를 전하세요" },
  { id: "christmas", name: "성탄절", month: 12, day: 25, anniversary_type: "family", memo: "사랑과 평안을 전하세요" },
  { id: "year-end", name: "연말", month: 12, day: 31, anniversary_type: "thanks", memo: "한 해의 고마움을 전하세요" },
];

function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextSolarDate(month: number, day: number, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  let target = new Date(start.getFullYear(), month - 1, day);
  if (target.getTime() < start.getTime()) {
    target = new Date(start.getFullYear() + 1, month - 1, day);
  }
  return toDateString(target);
}

function getNextMappedDate(yearlyDates: Record<number, string>, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Object.values(yearlyDates)
    .filter((date) => new Date(date).getTime() >= start.getTime())
    .sort()[0] ?? Object.values(yearlyDates).sort()[0];
}

function getDefaultAnniversaryDate(item: DefaultAnniversary) {
  if (item.yearlyDates && Object.keys(item.yearlyDates).length > 0) return getNextMappedDate(item.yearlyDates);
  if (typeof item.month !== "number" || typeof item.day !== "number") return null;
  return getNextSolarDate(item.month!, item.day!);
}

function getCalendarAnniversaryDate(item: DefaultAnniversary, year: number) {
  if (item.yearlyDates && Object.keys(item.yearlyDates).length > 0) {
    return item.yearlyDates[year] ?? Object.values(item.yearlyDates).find(Boolean) ?? null;
  }
  if (typeof item.month !== "number" || typeof item.day !== "number") return null;
  return `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
}

function getAnniversaryIcon(type: string) {
  if (type === "birthday") return <Cake size={30} />;
  if (type === "love") return <Heart size={30} fill="currentColor" />;
  if (type === "thanks") return <Heart size={30} />;
  if (type === "family") return <Flower2 size={30} />;
  return <CalendarDays size={30} />;
}

function useCommonAnniversaries() {
  const [items, setItems] = useState<DefaultAnniversary[]>(KOREAN_DEFAULT_ANNIVERSARIES);
  const [settings, setSettings] = useState<CommonAnniversarySetting>({ max_visible: 3, window_days: 7 });

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const [{ data: anniversariesData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("common_anniversaries")
          .select("id, name, month, day, yearly_dates, anniversary_type, memo, is_active, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("common_anniversary_settings")
          .select("max_visible, window_days")
          .eq("id", "home")
          .maybeSingle(),
      ]);

      if (!mounted) return;
      if (anniversariesData?.length) {
        setItems(anniversariesData.map((item) => ({
          id: item.id,
          name: item.name,
          month: item.month ?? undefined,
          day: item.day ?? undefined,
          yearlyDates: item.yearly_dates && Object.keys(item.yearly_dates).length > 0
            ? item.yearly_dates as Record<number, string>
            : undefined,
          anniversary_type: item.anniversary_type,
          memo: item.memo,
          is_active: item.is_active,
          sort_order: item.sort_order,
        })));
      }
      if (settingsData) {
        setSettings({
          max_visible: settingsData.max_visible,
          window_days: settingsData.window_days,
        });
      }
    };

    load().catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return { items, settings };
}

export function HomeScreen() {
  const { cards } = useSupabaseCards();
  const { items: anniversaries } = useSupabaseAnniversaries();
  const { items: commonAnniversaries, settings: commonSettings } = useCommonAnniversaries();
  const { items: dbBackgrounds } = useDbBackgrounds();
  const { items: homeCards, fetching: homeCardsFetching } = useHomeFeaturedCards();
  const { user, loading: authLoading } = useAuth();
  const [themeOpen, setThemeOpen] = useState(false);
  const recentCards = cards.filter((c) => !c.id.startsWith("sample-")).slice(0, 4);
  const featuredCard = recentCards[0] ?? cards[0];
  const featuredHomeCard = homeCards[0] ?? null;
  const homeBackground = dbBackgrounds.find((bg) => bg.category === "home") ?? dbBackgrounds[0];
  const upcomingItems = [
    ...anniversaries.map((item) => ({
      id: `user-${item.id}`,
      name: item.name,
      date: item.date,
      anniversary_type: item.anniversary_type,
      memo: item.memo ?? "직접 등록한 기념일",
      source: "user" as const,
    })),
    ...commonAnniversaries
      .map((item) => {
        const date = getDefaultAnniversaryDate(item);
        if (!date) return null;
        return {
          id: `default-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo,
          source: "default" as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  ]
    .map((item) => ({ ...item, dday: getDDay(item.date) }))
    .sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      if (ad !== bd) return ad - bd;
      return a.source === "user" ? -1 : 1;
    });
  const visibleUpcomingItems = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowMs = commonSettings.window_days * 24 * 60 * 60 * 1000;
    const inWindow = upcomingItems.filter((item) => {
      const diff = new Date(item.date).getTime() - today.getTime();
      return diff >= 0 && diff <= windowMs;
    });
    const selected = inWindow.length > 0 ? inWindow : upcomingItems.slice(0, 1);
    return selected.slice(0, commonSettings.max_visible);
  })();
  const displayName = user?.nickname ?? "마음님";
  // 관리자 추천 카드 로딩이 끝나기 전엔 유저 카드/배경으로 폴백하지 않는다.
  // (먼저 로드된 유저 카드가 떴다가 관리자 카드로 교체되며 사라지는 깜빡임 방지)
  const featuredFallback = homeCardsFetching ? null : (featuredCard ?? null);
  const featuredMessage = featuredHomeCard?.message || featuredFallback?.message || "오늘도 당신을 응원합니다";
  const featuredTitle = featuredHomeCard?.title || "오늘의 카드";
  const featuredCtaLabel = featuredHomeCard?.cta_label || "카드 만들기";
  const featuredLink = featuredHomeCard?.link_href || "/create/background";
  const featuredImageUrl = featuredHomeCard?.image_url || featuredFallback?.cardImageUrl || (homeCardsFetching ? null : homeBackground?.url) || null;

  return (
    <PhoneShell hideHeader>
      <IntroRedirect />
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur-md">
        <Link href="/" className="grid h-10 w-10 place-items-center" aria-label="홈">
          <ChevronLeft size={24} />
        </Link>
        <div className="text-center">
          <SmoothImage src="/logo/logo_onmaum_01.png" alt="ON마음" className="mx-auto h-8 w-auto" />
          <div className="mt-1 text-[11px] font-semibold text-stone-600">마음을 전하는 감성 메시지</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="디자인 설정"
          >
            <Settings size={18} />
          </button>
          <Link href="/mypage" aria-label="마이페이지" className="grid h-9 w-9 place-items-center">
            {user ? (
              <Avatar url={user.avatarUrl} nickname={user.nickname} size={34} />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-stone-200 bg-stone-100 text-stone-400">
                <User size={18} />
              </div>
            )}
          </Link>
        </div>
      </header>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}

      {authLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-200 border-t-[#7b310d]" />
        </div>
      ) : (
      <div className="w-full max-w-none px-5 pb-8 pt-6 sm:mx-auto sm:max-w-5xl sm:px-4 sm:pt-5 lg:px-6">
        {/* 히어로 — 온마음 캐릭터 + 인사말 + 새 카드 만들기 */}
        <section className="animate-pop-in mb-5 overflow-hidden rounded-3xl bg-gradient-to-b from-[#e9f0dd] via-[#f2efe2] to-[#f7f3ea] p-5 shadow-sm ring-1 ring-[#cfdcb8]/50">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/logo_onmaum_char_01.png"
              alt="온마음 캐릭터"
              className="animate-char-bob h-20 w-20 shrink-0 object-contain drop-shadow-sm"
              draggable={false}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#7b9a5a]">안녕하세요,</p>
              <h2 className="mt-0.5 text-lg font-black leading-snug text-[#4d3b2a]">
                {displayName}님<br />
                <span className="text-[#7b9a5a]">오늘도 따뜻한 마음을 전해요</span>
              </h2>
            </div>
          </div>
          <Link
            href="/create/background"
            className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#7b310d] text-base font-black text-white shadow-sm transition active:scale-[0.99] hover:brightness-105"
          >
            <Sparkles size={18} /> 새 카드 만들기
          </Link>
        </section>

        {/* 다가오는 기념일 */}
        {visibleUpcomingItems.length > 0 && (
          <section className="mb-5">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-700">다가오는 기념일</h3>
              <Link href="/anniversaries" className="flex items-center text-xs font-semibold text-stone-400 hover:text-stone-600">
                더보기 <ChevronRight size={14} />
              </Link>
            </div>
            <div className="space-y-2">
              {visibleUpcomingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href="/anniversaries"
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] hover:brightness-95 ${
                    index === 0 ? "bg-surface-container" : "border border-outline-variant/20 bg-surface-container-low"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    item.source === "user"
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-secondary-container text-on-secondary-container"
                  }`}>
                    {getAnniversaryIcon(item.anniversary_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <h4 className="min-w-0 truncate text-sm font-bold text-stone-800">{item.name}</h4>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        index === 0 ? "bg-primary text-on-primary" : "bg-stone-100 text-stone-500"
                      }`}>
                        {item.dday}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-400">{item.memo}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
          {/* 대표 카드 */}
          <section>
            <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-container">
                {featuredImageUrl ? (
                  <SmoothImage src={featuredImageUrl} alt={featuredHomeCard?.title ?? "추천 마음카드"} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="relative h-full w-full bg-gradient-to-br from-primary-fixed via-surface-container-lowest to-secondary-fixed">
                    <div className="absolute left-5 top-6 text-primary/25">
                      <Flower2 size={86} />
                    </div>
                    <div className="absolute bottom-8 right-5 text-primary/20">
                      <Flower2 size={118} />
                    </div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.75),transparent_42%)]" />
                  </div>
                )}
                {(featuredHomeCard?.show_title !== false || featuredHomeCard?.show_text !== false) && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="px-4 text-center">
                      {featuredHomeCard?.show_title !== false && featuredTitle && (
                        <span className="mb-2 inline-flex rounded-full bg-white/45 px-3 py-1 text-[11px] font-bold text-on-background backdrop-blur-sm">
                          {featuredTitle}
                        </span>
                      )}
                      {featuredHomeCard?.show_text !== false && featuredMessage && (
                        <span className="block rounded-lg bg-white/45 px-4 py-2 font-headline-lg text-headline-lg text-on-background backdrop-blur-sm">
                          {featuredMessage.length > 34 ? `${featuredMessage.slice(0, 34)}...` : featuredMessage} ♡
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {featuredImageUrl && (
                <div className="mb-3 flex w-full gap-2">
                  <button
                    onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        try {
                          await navigator.share({ url: featuredImageUrl, title: featuredTitle });
                        } catch {
                          // user cancelled or not supported
                        }
                      } else {
                        await navigator.clipboard.writeText(featuredImageUrl).catch(() => {});
                        window.alert("이미지 링크가 복사되었습니다.");
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-[0.98]"
                  >
                    <Share2 size={15} />
                    공유하기
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(featuredImageUrl);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `마음카드_${featuredTitle}_${Date.now()}.jpg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        window.open(featuredImageUrl, "_blank");
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-[0.98]"
                  >
                    <Download size={15} />
                    저장하기
                  </button>
                </div>
              )}
              <Link
                href={featuredLink}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] text-base font-black text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
              >
                <Pencil size={19} />
                {featuredCtaLabel}
              </Link>
            </div>
          </section>

          <div className="space-y-4">
            {/* 오늘의 추천 문구 */}
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-700">오늘의 추천 문구</h3>
                <Link href="/create/message" className="flex items-center text-xs font-semibold text-stone-400 hover:text-stone-600">
                  더보기 <ChevronRight size={14} />
                </Link>
              </div>
              <Link
                href="/create/message"
                className="relative block overflow-hidden rounded-xl border border-stone-100 bg-stone-50 px-5 py-4 text-center transition hover:bg-stone-100"
              >
                <Quote className="absolute left-2 top-2 scale-150 text-[#7b310d]/15" size={22} />
                <p className="text-sm font-semibold leading-relaxed text-stone-600">
                  가장 아름다운 시간은 바로 지금,<br />당신과 함께하는 오늘입니다.
                </p>
                <Heart className="absolute bottom-3 right-3 text-[#7b310d]/50" size={18} />
              </Link>
            </section>

            {/* 빠른 이동 */}
            <section className="grid grid-cols-2 gap-3">
              <Link href="/library" className="flex h-[120px] flex-col justify-between rounded-2xl bg-amber-50 p-4 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:brightness-95">
                <Inbox className="text-[#7b310d]" size={26} />
                <div>
                  <p className="text-sm font-black text-stone-800">보관함</p>
                  <p className="text-[11px] font-semibold text-stone-400">받은 카드 확인하기</p>
                </div>
              </Link>
              <Link href="/create/message?length=hand&purpose=hand" className="flex h-[120px] flex-col justify-between rounded-2xl bg-violet-50 p-4 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:brightness-95">
                <Sparkles className="text-violet-600" size={26} />
                <div>
                  <p className="text-sm font-black text-stone-800">손편지 쓰기</p>
                  <p className="text-[11px] font-semibold text-stone-400">AI와 함께 손편지 진심 만들기</p>
                </div>
              </Link>
            </section>
          </div>
        </div>
      </div>
      )}
      <MusicPlayer positionClassName="bottom-24 right-5" />
    </PhoneShell>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#7b310d] text-xs text-white">{n}</span>
      {children}
    </div>
  );
}

type MsgLength = "short" | "long" | "hand";
type ShortMode = "recommend" | "direct";
type LongMode = "long_recommend" | "direct";
type HandMode = "hand_recommend" | "direct";

// AI 문장 수정 — 직접입력에서 고를 수 있는 느낌(말투) 옵션 10가지. id는 /api/ai-correct의 TONE_INSTRUCTIONS와 매칭.
const AI_TONE_OPTIONS: { id: string; label: string }[] = [
  { id: "warm", label: "따뜻하게" },
  { id: "polite", label: "예의바르게" },
  { id: "lovely", label: "사랑스럽게" },
  { id: "formal", label: "정중하게" },
  { id: "sincere", label: "진심을 담아" },
  { id: "cheerful", label: "유쾌하게" },
  { id: "poetic", label: "감성적으로" },
  { id: "concise", label: "간결하게" },
  { id: "comforting", label: "위로가 되게" },
  { id: "encouraging", label: "격려하듯" },
];

export function MessageScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDirect = searchParams.get("mode") === "direct";
  const initialLength = searchParams.get("length");
  const requestedPurpose = searchParams.get("purpose");
  const [draft, setDraft, draftHydrated] = useDraft();
  const messageEntryResetRef = useRef(false);
  const {
    favorites: myMessages,
    loading: myMessagesLoading,
    isSaved: isFavSaved,
    toggle: toggleFavMsg,
  } = useFavMessages();
  const [length, setLength] = useState<MsgLength>(initialLength === "hand" ? "hand" : "short");
  const [shortMode, setShortMode] = useState<ShortMode>(isDirect ? "direct" : "recommend");
  const [longMode, setLongMode] = useState<LongMode>(isDirect ? "direct" : "long_recommend");
  const [handMode, setHandMode] = useState<HandMode>(isDirect ? "direct" : "hand_recommend");
  const uiSettings = usePublicUiSettings();
  const handMessageMaxLength = handMessageMaxLengthByTone.general;
  const handMessages = handMessagesByTone.general;
  const enabledHandFontOptions = handFontOptions.filter((option) => {
    if (option.id === "round") return uiSettings.hand_font_round_enabled;
    if (option.id === "brush") return uiSettings.hand_font_brush_enabled;
    return uiSettings.hand_font_pen_enabled;
  });
  const [correcting, setCorrecting] = useState(false);
  const [correctedOptions, setCorrectedOptions] = useState<string[] | null>(null);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctTone, setCorrectTone] = useState<string>(AI_TONE_OPTIONS[0].id);

  // 직접입력 음성 모드 — 마이크로 말하면 받아쓰기되어 본문에 입력된다.
  const { supported: voiceSupported, listening: voiceListening, start: startVoice, stop: stopVoice } = useSpeechToText("ko-KR");
  const voiceBaseRef = useRef("");
  const toggleVoice = () => {
    if (voiceListening) {
      stopVoice();
      return;
    }
    voiceBaseRef.current = draft.message ? draft.message.trimEnd() + " " : "";
    startVoice((sessionText) => {
      const combined = (voiceBaseRef.current + sessionText).slice(0, handMessageMaxLength);
      setDraft({ message: combined, messageOrigin: "direct", contentRotation: undefined });
      setCorrectedOptions(null);
    });
  };

  useEffect(() => {
    if (!draftHydrated || messageEntryResetRef.current) return;
    messageEntryResetRef.current = true;
    setDraft({
      message: "",
      messageOrigin: undefined,
      title: "",
      footer: "",
      authorEnabled: false,
      author: "",
      textBox: undefined,
      titleTextBox: undefined,
      contentTextBox: undefined,
      footerTextBox: undefined,
      titleRotation: undefined,
      contentRotation: undefined,
      footerRotation: undefined,
      titleScale: undefined,
      contentScale: undefined,
      titleColor: undefined,
      contentColor: undefined,
      footerColor: undefined,
      titleFont: undefined,
      contentFont: undefined,
    });
    setCorrectedOptions(null);
    setCorrectError(null);
  }, [draftHydrated, setDraft]);

  const selectedPurpose = draft.purpose || "love";
  const [recommendCategory, setRecommendCategory] = useState<RecommendationCategory>(
    selectedPurpose === "hand" ? "all" : (selectedPurpose as RecommendationCategory),
  );
  const shortRecommendGroups = getRecommendedGroups(messagesByPurpose, recommendCategory);
  const longRecommendGroups = getRecommendedGroups(longMessagesByPurpose, recommendCategory);
  const canGoNext = draft.message.trim().length > 0;

  const isDirectMode =
    (length === "short" && shortMode === "direct") ||
    (length === "long" && longMode === "direct") ||
    (length === "hand" && handMode === "direct");

  useEffect(() => {
    if (!honorificOptions.includes(draft.honorific)) {
      setDraft({ honorific: "에게" });
    }
  }, [draft.honorific, setDraft]);

  useEffect(() => {
    if (length !== "hand") return;
    if (!enabledHandFontOptions.length) return;
    if (enabledHandFontOptions.some((option) => option.id === draft.handFont)) return;
    setDraft({ handFont: enabledHandFontOptions[0].id });
  }, [draft.handFont, enabledHandFontOptions, length, setDraft]);

  useEffect(() => {
    if (requestedPurpose === "custom" && draft.purpose !== "custom") {
      setDraft({ purpose: "custom" });
    }
    if (requestedPurpose === "hand" && draft.purpose !== "hand") {
      setDraft({ purpose: "hand", handTone: "general", honorific: "에게", handMode: "recommend", titleFont: "himelody", contentFont: "pen" });
    }
  }, [draft.purpose, requestedPurpose, setDraft]);

  const fetchAiCorrect = useCallback(async (toneOverride?: string) => {
    if (!draft.message.trim() || correcting) return;
    setCorrecting(true);
    setCorrectError(null);
    setCorrectedOptions(null);
    try {
      const res = await fetch("/api/ai-correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.message, tone: toneOverride ?? correctTone }),
      });
      const data = await res.json() as { corrected?: string[] | string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "수정 실패");
      const options = (Array.isArray(data.corrected) ? data.corrected : data.corrected ? [data.corrected] : [])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);
      setCorrectedOptions(options.length > 0 ? options : null);
    } catch (err) {
      setCorrectError(err instanceof Error ? err.message : "AI 문장 수정 실패");
    } finally {
      setCorrecting(false);
    }
  }, [correcting, draft.message, correctTone]);

  const myMessagesPanel = (
    <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-black text-[#7b310d]">
          <Bookmark size={15} className="fill-[#7b310d]" />
          내 문구
        </h3>
        <span className="text-[11px] font-semibold text-stone-400">
          {myMessagesLoading ? "불러오는 중..." : `${myMessages.length}개`}
        </span>
      </div>
      {!myMessagesLoading && myMessages.length === 0 ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-stone-400">
          보관함의 내용보기에서 마음에 드는 문구를 저장해보세요.
        </p>
      ) : (
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {myMessages.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border bg-white ${
                draft.message === item.text ? "border-[#d98238] ring-1 ring-[#d98238]/30" : "border-stone-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setDraft({ message: item.text, messageOrigin: "recommend", contentRotation: undefined })}
                className="flex-1 whitespace-pre-wrap px-3 py-2.5 text-left text-sm leading-6 text-stone-700"
              >
                {item.text}
              </button>
              <button
                type="button"
                onClick={() => toggleFavMsg(item.text, item.purpose ?? undefined)}
                className="shrink-0 p-3 text-[#7b310d]"
                aria-label="내 문구에서 삭제"
              >
                <Bookmark size={16} className="fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <PhoneShell backHref="/create/background">
      <div className="space-y-5">
        {/* 카드 꾸미기 — 받는 사람·보내는 사람 */}
        <div className="space-y-3 rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-stone-700">
            카드 꾸미기 <span className="text-xs font-normal text-stone-400">(선택)</span>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500">받는 사람</label>
            <input
              type="text"
              value={draft.title ?? ""}
              onChange={(e) => setDraft({ title: e.target.value })}
              placeholder="예: 사랑하는 엄마께, 민수에게"
              maxLength={20}
              className="mt-1.5 h-11 w-full rounded-lg border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500">보내는 사람</label>
            <input
              type="text"
              value={draft.footer ?? ""}
              onChange={(e) => setDraft({ footer: e.target.value })}
              placeholder="예: 사랑하는 딸 지은이가"
              maxLength={40}
              className="mt-1.5 h-11 w-full rounded-lg border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
            />
          </div>
        </div>

        <div>
          <StepLabel n={1}>전하고 싶은 글귀를 선택하거나 입력해주세요.</StepLabel>

          {/* 단문추천 / 장문추천 / 직접입력 */}
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
            {([
              ["short", "단문추천"],
              ["long", "장문추천"],
              ["direct", "직접입력"],
            ] as const).map(([mode, label]) => {
              const active =
                mode === "short" ? length === "short" && shortMode === "recommend"
                : mode === "long" ? length === "long" && longMode === "long_recommend"
                : isDirectMode;
              return (
              <button
                key={mode}
                onClick={() => {
                  if (active) return;
                  if (mode === "short") {
                    setLength("short");
                    setShortMode("recommend");
                    setDraft({ message: "", messageOrigin: undefined, contentRotation: undefined });
                  } else if (mode === "long") {
                    setLength("long");
                    setLongMode("long_recommend");
                    setDraft({ message: "", messageOrigin: undefined, contentRotation: undefined });
                  } else {
                    setLength("hand");
                    setHandMode("direct");
                    setDraft({
                      message: "",
                      messageOrigin: "direct",
                      contentRotation: undefined,
                      handTone: "general",
                      handMode: "direct",
                      titleFont: "himelody",
                      contentFont: "pen",
                    });
                  }
                }}
                className={`h-11 rounded-lg text-sm font-black transition-all ${
                  active ? "bg-[#7b310d] text-white shadow" : "text-stone-500 hover:bg-white"
                }`}
              >
                {label}
              </button>
              );
            })}
          </div>

          {/* 직접 입력 */}
          {isDirectMode ? (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <textarea
                  value={draft.message}
                  onChange={(e) => {
                    const nextValue = e.target.value.slice(0, handMessageMaxLength);
                    setDraft({ message: nextValue, messageOrigin: "direct", contentRotation: undefined });
                    setCorrectedOptions(null);
                  }}
                  placeholder={length === "hand"
                    ? "마음을 담아 손편지처럼 길게 써보세요."
                    : length === "long"
                      ? "마음을 담아 편지를 써보세요. (장문)"
                      : "마음을 담은 문구를 입력해주세요."}
                  maxLength={length === "hand" ? handMessageMaxLength : undefined}
                  className={`w-full rounded-md border border-stone-200 p-4 pb-16 leading-7 outline-none focus:border-[#7b310d] ${length === "hand" || length === "long" ? "min-h-52" : "min-h-40"}`}
                  style={length === "hand" ? { fontFamily: HAND_GOTHIC_FONT, fontSize: `${uiSettings.hand_compose_font_size}px` } : undefined}
                />
                {/* 음성 입력 — 마이크를 눌러 말하면 받아쓰기되어 본문에 입력 */}
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    aria-label={voiceListening ? "음성 입력 중지" : "음성으로 입력"}
                    className={`absolute bottom-3 right-3 flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white shadow transition active:scale-95 ${
                      voiceListening ? "animate-pulse bg-red-500" : "bg-[#7b310d]"
                    }`}
                  >
                    {voiceListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {voiceListening ? "듣는 중..." : "음성 입력"}
                  </button>
                )}
              </div>
              {length === "hand" && (
                <p className={`text-right text-xs font-semibold ${draft.message.length > handMessageMaxLength * 0.9 ? "text-[#7b310d]" : "text-stone-400"}`}>
                  {draft.message.length}/{handMessageMaxLength}
                </p>
              )}
              {draft.message.trim().length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                  {length === "short" ? (
                    // 단문: 맞춤법 바로잡기만 (느낌 옵션 없음)
                    <button
                      onClick={() => fetchAiCorrect("spelling")}
                      disabled={correcting}
                      className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-600 to-[#7b310d] text-sm font-bold text-white disabled:opacity-60"
                    >
                      {correcting ? "✨ 바로잡는 중..." : "✨ 맞춤법 바로잡기 (1C)"}
                    </button>
                  ) : length === "hand" ? (
                    // 손편지 직접입력: 느낌 선택 없이 문장 수정만 제공
                    <button
                      onClick={() => fetchAiCorrect("sincere")}
                      disabled={correcting}
                      className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-600 to-[#7b310d] text-sm font-bold text-white disabled:opacity-60"
                    >
                      {correcting ? "✨ AI가 다듬는 중..." : "✨ AI 문장 수정 (1C)"}
                    </button>
                  ) : (
                    // 장문: 느낌 옵션 + AI 문장 수정
                    <>
                      <p className="mb-2 text-xs font-bold text-violet-700">느낌 선택</p>
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {AI_TONE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setCorrectTone(option.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                              correctTone === option.id
                                ? "bg-violet-600 text-white"
                                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => fetchAiCorrect()}
                        disabled={correcting}
                        className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-600 to-[#7b310d] text-sm font-bold text-white disabled:opacity-60"
                      >
                        {correcting ? "✨ AI가 다듬는 중..." : "✨ AI 문장 수정 (1C)"}
                      </button>
                    </>
                  )}
                  {correctError && <p className="mt-2 text-xs font-semibold text-red-600">{correctError}</p>}
                  {correctedOptions && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-violet-600">원문과 비교 후 선택하세요</p>
                        <button onClick={() => setCorrectedOptions(null)} className="text-xs font-bold text-stone-400 hover:text-stone-600">닫기</button>
                      </div>

                      {/* 원문 */}
                      <div className="rounded-lg border border-stone-200 bg-white p-3">
                        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-stone-400">원문</p>
                        <p className="whitespace-pre-line text-sm leading-7 text-stone-600">{draft.message}</p>
                      </div>

                      {/* AI 수정안들 */}
                      {correctedOptions.map((option, index) => {
                        const selected = draft.message === option;
                        return (
                          <button
                            key={`${index}-${option.slice(0, 12)}`}
                            type="button"
                            onClick={() => setDraft({ message: option, messageOrigin: "direct", contentRotation: undefined })}
                            className={`w-full rounded-lg border-2 p-3 text-left transition ${
                              selected ? "border-violet-500 bg-violet-50" : "border-violet-200 bg-white hover:bg-violet-50/50"
                            }`}
                          >
                            <span className="mb-1 flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase tracking-wide text-violet-600">
                                ✨ AI 수정안 {correctedOptions.length > 1 ? index + 1 : ""}
                              </span>
                              {selected && <span className="text-[11px] font-bold text-violet-600">선택됨 ✓</span>}
                            </span>
                            <span className="block whitespace-pre-line text-sm leading-7 text-stone-900">{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2">

              {/* 단문 메시지 목록 */}
              {length === "short" && shortMode === "recommend" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendationCategoryOrder.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setRecommendCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        recommendCategory === category ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {recommendationCategoryLabels[category]}
                    </button>
                  ))}
                </div>
              )}

              {length === "short" && shortMode === "recommend" && recommendCategory === "mine" && myMessagesPanel}

              {length === "short" && shortMode === "recommend" && recommendCategory !== "mine" && (
                <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
                  {shortRecommendGroups.map((group) => (
                    <div key={group.purpose}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">{group.label}</h4>
                        <span className="text-[11px] font-semibold text-stone-400">{group.messages.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {group.messages.map((msg) => (
                          <div key={msg} className={`flex items-center gap-2 rounded-md border ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200"}`}>
                            <button onClick={() => setDraft({ message: msg, messageOrigin: "recommend", contentRotation: undefined })} className="flex flex-1 items-center gap-2 p-3 text-left text-sm leading-6">
                              <Heart size={16} className={`shrink-0 ${draft.message === msg ? "fill-[#d98238] text-[#d98238]" : "text-stone-300"}`} />
                              <span>{msg}</span>
                            </button>
                            <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="shrink-0 p-3" aria-label="즐겨찾기">
                              <Bookmark size={16} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : "text-stone-300"} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* 장문 메시지 목록 */}
              {length === "long" && longMode === "long_recommend" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendationCategoryOrder.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setRecommendCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        recommendCategory === category ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {recommendationCategoryLabels[category]}
                    </button>
                  ))}
                </div>
              )}

              {length === "long" && longMode === "long_recommend" && recommendCategory === "mine" && myMessagesPanel}

              {length === "long" && longMode === "long_recommend" && recommendCategory !== "mine" && (
                <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
                  {longRecommendGroups.map((group) => (
                    <div key={group.purpose}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">{group.label}</h4>
                        <span className="text-[11px] font-semibold text-stone-400">{group.messages.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {group.messages.map((msg) => (
                          <div key={msg} className={`rounded-xl border p-4 ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200 bg-white"}`}>
                            <p className="whitespace-pre-line text-sm leading-7 text-stone-700">{msg}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="flex items-center gap-1 text-xs font-bold text-stone-400" aria-label="즐겨찾기">
                                <Bookmark size={13} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : ""} />
                                {isFavSaved(msg) ? "저장됨" : "저장"}
                              </button>
                              <button
                                onClick={() => setDraft({ message: msg, messageOrigin: "recommend", contentRotation: undefined })}
                                className={`rounded-md px-4 py-1.5 text-xs font-bold ${draft.message === msg ? "bg-[#7b310d] text-white" : "border border-[#7b310d] text-[#7b310d]"}`}
                              >
                                {draft.message === msg ? "선택됨 ✓" : "이 글로 카드 만들기"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* 손편지 메시지 목록 */}
              {length === "hand" && (handMode === "hand_recommend" || handMode === "direct") &&
                handMessages.map((msg) => (
                  <div key={msg} className={`rounded-xl border p-4 ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200 bg-white"}`}>
                    <p className="whitespace-pre-line text-sm leading-7 text-stone-700" style={{ fontFamily: HAND_GOTHIC_FONT, fontSize: `${uiSettings.hand_compose_font_size}px` }}>
                      {msg}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="flex items-center gap-1 text-xs font-bold text-stone-400" aria-label="즐겨찾기">
                        <Bookmark size={13} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : ""} />
                        {isFavSaved(msg) ? "저장됨" : "저장"}
                      </button>
                      <button
                        onClick={() => setDraft({ message: msg, messageOrigin: "recommend", contentRotation: undefined })}
                        className={`rounded-md px-4 py-1.5 text-xs font-bold ${draft.message === msg ? "bg-[#7b310d] text-white" : "border border-[#7b310d] text-[#7b310d]"}`}
                      >
                        {draft.message === msg ? "선택됨 ✓" : "이 편지로 카드 만들기"}
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-stone-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {!canGoNext && (
            <p className="mb-1 text-center text-xs font-semibold text-stone-400">
              글귀를 선택하거나 입력해 주세요
            </p>
          )}
          <PrimaryButton disabled={!canGoNext} onClick={() => router.push("/create/preview")}>카드 만들기</PrimaryButton>
          {uiSettings.ai_compose_enabled && (
            <button
              disabled={!canGoNext}
              onClick={() => router.push("/create/preview?ai=1")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#7b310d] bg-white px-4 py-3 text-center font-bold text-[#7b310d] transition active:scale-[0.99] disabled:border-stone-200 disabled:text-stone-300"
            >
              <Sparkles size={18} /> AI로 만들기
            </button>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}

type DbBackground = {
  id: string;
  name: string;
  category: string;
  url: string;
  is_active: boolean;
};

type HomeFeaturedCard = {
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
};

function useDbBackgrounds() {
  const [items, setItems] = useState<DbBackground[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("backgrounds")
        .select("id, name, category, url, is_active, sort_order, created_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (mounted) {
        setItems((data ?? []) as DbBackground[]);
        setFetching(false);
      }
    };

    load().catch(() => {
      if (mounted) setFetching(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { items, fetching };
}

function useHomeFeaturedCards() {
  const [items, setItems] = useState<HomeFeaturedCard[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("home_featured_cards")
        .select("id, title, message, image_url, link_href, cta_label, is_active, show_title, show_text, sort_order, created_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (mounted) {
        setItems((data ?? []) as HomeFeaturedCard[]);
        setFetching(false);
      }
    };

    load().catch(() => {
      if (mounted) setFetching(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { items, fetching };
}

const BG_CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "home", label: "🏠 홈 대표" },
  { id: "nature", label: "🌿 자연" },
  { id: "season", label: "🌸 계절" },
  { id: "emotion", label: "💞 감성" },
  { id: "city", label: "🏙️ 도시" },
  { id: "abstract", label: "✨ 추상" },
  { id: "pattern", label: "🎨 패턴" },
];

// 배경 사진 필터 프리셋 (미리보기에서 선택, 서버 sharp 로 baked)
const BG_FILTERS: Array<{ id: string; label: string }> = [
  { id: "none", label: "원본" },
  { id: "bright", label: "밝게" },
  { id: "insta", label: "인스타" },
  { id: "bw", label: "흑백" },
  { id: "vintage", label: "빈티지" },
];

// 내 사진(사용자 업로드) 분류용 카테고리
const MY_PHOTO_CATEGORIES = [
  { id: "portrait", label: "👤 인물" },
  { id: "scenery", label: "🏞️ 풍경" },
  { id: "daily", label: "☕ 일상" },
  { id: "travel", label: "✈️ 여행" },
  { id: "etc", label: "📌 기타" },
];

type UserBackground = {
  id: string;
  name: string;
  category: string;
  url: string;
  storage_path: string;
};

const USER_BG_BUCKET = "user-backgrounds";

// 계정별 업로드 배경: 로드 / 업로드(스토리지+DB) / 삭제
function useUserBackgrounds() {
  const [items, setItems] = useState<UserBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_backgrounds")
      .select("id, name, category, url, storage_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as UserBackground[]);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = useCallback(async (file: File, category: string): Promise<UserBackground | null> => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있어요.");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("10MB 이하 이미지만 올릴 수 있어요.");
      return null;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("로그인 후 이용해주세요.");
        return null;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(USER_BG_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(USER_BG_BUCKET).getPublicUrl(storagePath);
      const { data: inserted, error: insertError } = await supabase
        .from("user_backgrounds")
        .insert({ user_id: user.id, name: file.name.slice(0, 60), category, storage_path: storagePath, url: publicUrl })
        .select("id, name, category, url, storage_path")
        .single();
      if (insertError) throw insertError;

      const item = inserted as UserBackground;
      setItems((prev) => [item, ...prev]);
      return item;
    } catch {
      setError("사진 업로드에 실패했어요. 다시 시도해주세요.");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const remove = useCallback(async (item: UserBackground) => {
    setItems((prev) => prev.filter((b) => b.id !== item.id));
    const supabase = createClient();
    await supabase.storage.from(USER_BG_BUCKET).remove([item.storage_path]);
    await supabase.from("user_backgrounds").delete().eq("id", item.id);
  }, []);

  return { items, loading, uploading, error, upload, remove };
}

export function BackgroundScreen() {
  const router = useRouter();
  const [draft, setDraft] = useDraft();
  const uiSettings = usePublicUiSettings();
  const [tab, setTab] = useState<"gallery" | "mine" | "ai">("gallery");
  const [catFilter, setCatFilter] = useState("all");
  const [aiPrompt, setAiPrompt] = useState("");
  // 내 사진(업로드) 관련
  const userBgs = useUserBackgrounds();
  const [uploadCat, setUploadCat] = useState("etc");
  const [mineFilter, setMineFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    const item = await userBgs.upload(file, uploadCat);
    if (item) {
      setDraft({ bg: item.url });
      setMineFilter("all");
    }
  };
  const { loading: aiLoading, progress: aiProgress, url: aiUrl, error: aiError, generate: aiGenerate, reset: aiReset } = useAIBackground();
  const { items: dbBgs, fetching } = useDbBackgrounds();

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    aiGenerate(aiPrompt.trim(), {
      purpose: draft.purpose || "love",
      promptCode: draft.purpose === "birthday" ? "BIRTHDAY_FLOWER_WARM" : undefined,
      recipient: draft.name,
      honorific: draft.honorific,
      message: draft.message,
    });
  };

  // 빈영역 탐지 테스트
  const [wsRegion, setWsRegion] = useState<WsRegion | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsMeta, setWsMeta] = useState<{ band: string; ms: number; emptiness: number; brightness: number; wRatio: number; hRatio: number } | null>(null);

  useEffect(() => { setWsRegion(null); setWsMeta(null); }, [draft.bg]);

  const runWhitespaceTest = async () => {
    if (!draft.bg) return;
    setWsLoading(true);
    setWsRegion(null);
    try {
      const res = await fetch("/api/whitespace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bg: draft.bg }),
      });
      const data = (await res.json()) as { region?: WsRegion; ms?: number };
      if (data.region) {
        setWsRegion(data.region);
        setWsMeta({
          band: data.region.band,
          ms: data.ms ?? 0,
          emptiness: data.region.emptiness,
          brightness: data.region.brightness ?? 0,
          wRatio: data.region.wRatio,
          hRatio: data.region.hRatio,
        });
      }
    } catch {
      // 무시 (테스트용)
    } finally {
      setWsLoading(false);
    }
  };

  const wsPreviewSrc = draft.bg?.startsWith("ai:")
    ? draft.bg.slice(3)
    : draft.bg?.startsWith("http") || draft.bg?.startsWith("data:")
      ? draft.bg
      : null;
  const wsPreviewSwatch = wsPreviewSrc ? null : backgrounds.find((b) => b.id === draft.bg)?.swatch;

  // 재정렬 흐름: 배경 → 글귀. 목적/직접입력 의도를 파라미터로 전달.
  const messageHref = (() => {
    const params = new URLSearchParams();
    if (draft.purpose === "hand") params.set("length", "hand");
    if (draft.directMode) params.set("mode", "direct");
    if (draft.purpose === "custom") params.set("purpose", "custom");
    const qs = params.toString();
    return qs ? `/create/message?${qs}` : "/create/message";
  })();

  return (
    <PhoneShell backHref="/">
      <h1 className="text-center text-2xl font-black leading-9">마음에 드는 배경을<br />선택해주세요.</h1>
      {/* 재정렬 흐름: 배경(1단계) */}

      {/* 탭 — 배경 갤러리 / 내 사진 / (✨ AI 생성: 관리자 활성 시) */}
      {(() => {
        const tabs: Array<readonly ["gallery" | "mine" | "ai", string]> = [
          ["gallery", "배경 갤러리"],
          ["mine", "📷 내 사진"],
          ...(uiSettings.ai_background_enabled ? [["ai", "✨ AI 생성"] as const] : []),
        ];
        return (
          <div
            className="mt-5 grid gap-1 rounded-xl bg-stone-100 p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`h-10 rounded-lg text-xs font-bold transition ${tab === key ? "bg-[#7b310d] text-white shadow" : "text-stone-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* 저장된 배경 갤러리 */}
      {tab === "gallery" && (
        fetching ? (
          <div className="mt-6 flex justify-center py-12 text-stone-400">
            <div className="grid h-10 w-10 place-items-center rounded-full border-4 border-stone-200 border-t-[#7b310d] animate-spin" />
          </div>
        ) : dbBgs.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-300 py-12 text-stone-400">
            <p className="font-semibold text-sm">저장된 배경이 없어요.</p>
            <p className="text-xs">관리자 페이지에서 배경을 먼저 생성해주세요.</p>
            <a href="/admin/backgrounds" className="mt-1 rounded-lg bg-[#7b310d] px-4 py-2 text-xs font-bold text-white">
              배경 관리 →
            </a>
          </div>
        ) : (
          <>
            {/* 카테고리 필터 */}
            {(() => {
              const usedCats = new Set(dbBgs.map((b) => b.category));
              const visibleCats = BG_CATEGORIES.filter((c) => c.id === "all" || usedCats.has(c.id));
              return visibleCats.length > 1 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {visibleCats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCatFilter(c.id)}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${catFilter === c.id ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {dbBgs
                .filter((bg) => catFilter === "all" || bg.category === catFilter)
                .map((bg) => {
                  const selected = draft.bg === bg.url;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setDraft({ bg: bg.url })}
                      className={`relative aspect-[3/4] overflow-hidden rounded-xl ${selected ? "ring-4 ring-[#7b310d]" : ""}`}
                    >
                      <SmoothImage src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#7b310d] text-white">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </>
        )
      )}

      {/* 내 사진 (계정별 업로드 배경) */}
      {tab === "mine" && (
        <div className="mt-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handlePickFile}
          />

          {/* 업로드: 카테고리 선택 후 사진 올리기 */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-bold text-stone-500">분류 선택 후 사진을 올리면 내 배경으로 저장돼요.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {MY_PHOTO_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setUploadCat(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${uploadCat === c.id ? "bg-[#7b310d] text-white" : "bg-white text-stone-600 border border-stone-200"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={userBgs.uploading}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] text-sm font-bold text-white transition active:scale-[0.99] disabled:bg-stone-300"
            >
              {userBgs.uploading ? "올리는 중..." : (<><Plus size={18} /> 사진 올리기</>)}
            </button>
            {userBgs.error && <p className="mt-2 text-xs font-bold text-red-500">{userBgs.error}</p>}
          </div>

          {/* 내 사진 목록 */}
          {userBgs.loading ? (
            <div className="flex justify-center py-10 text-stone-400">
              <div className="grid h-10 w-10 place-items-center rounded-full border-4 border-stone-200 border-t-[#7b310d] animate-spin" />
            </div>
          ) : userBgs.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 py-10 text-stone-400">
              <p className="text-sm font-semibold">아직 올린 사진이 없어요.</p>
              <p className="text-xs">위에서 사진을 올려 나만의 배경을 만들어보세요.</p>
            </div>
          ) : (
            <>
              {/* 카테고리 필터 */}
              {(() => {
                const usedCats = new Set(userBgs.items.map((b) => b.category));
                const visibleCats = [{ id: "all", label: "전체" }, ...MY_PHOTO_CATEGORIES.filter((c) => usedCats.has(c.id))];
                return visibleCats.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {visibleCats.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setMineFilter(c.id)}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${mineFilter === c.id ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600"}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-3 gap-2">
                {userBgs.items
                  .filter((bg) => mineFilter === "all" || bg.category === mineFilter)
                  .map((bg) => {
                    const selected = draft.bg === bg.url;
                    return (
                      <div key={bg.id} className={`relative aspect-[3/4] overflow-hidden rounded-xl ${selected ? "ring-4 ring-[#7b310d]" : ""}`}>
                        <button onClick={() => setDraft({ bg: bg.url })} className="block h-full w-full" aria-label="이 사진을 배경으로 사용">
                          <SmoothImage src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
                        </button>
                        {selected && (
                          <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#7b310d] text-white">
                            <Check size={13} />
                          </span>
                        )}
                        <button
                          onClick={() => userBgs.remove(bg)}
                          className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white transition hover:bg-red-500"
                          aria-label="사진 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* AI 생성 */}
      {tab === "ai" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-stone-600">
            원하는 배경 분위기를 입력하면 카드 문구와 받는 분에 맞춰 감성 배경을 만들어드려요. (크레딧 1개 소모)
          </p>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="예: 봄 벚꽃, 따뜻한 석양, 잔잔한 바다..."
              className="flex-1 h-12 rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            />
            <button
              onClick={handleAiGenerate}
              disabled={!aiPrompt.trim() || aiLoading}
              className="h-12 shrink-0 rounded-xl bg-[#7b310d] px-4 text-sm font-bold text-white disabled:bg-stone-300"
            >
              생성
            </button>
          </div>

          {aiLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="grid h-24 w-24 place-items-center rounded-full border-[8px] border-purple-200 border-t-[#6f3cc3] text-xl font-black text-[#6f3cc3]">
                {aiProgress}%
              </div>
              <p className="text-sm font-bold text-stone-600">AI가 문구가 잘 어울리는 배경을 만들고 있어요...</p>
            </div>
          )}

          {aiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {aiError}
              <button onClick={aiReset} className="ml-2 underline">다시 시도</button>
            </div>
          )}

          {aiUrl && !aiLoading && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl aspect-[3/4]">
                <SmoothImage src={aiUrl} alt="AI 생성 배경" className="h-full w-full object-cover" />
                {draft.bg === `ai:${aiUrl}` && (
                  <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#7b310d] text-white">
                    <Check size={16} />
                  </div>
                )}
              </div>
              <button
                onClick={() => setDraft({ bg: `ai:${aiUrl}` })}
                className={`w-full h-11 rounded-xl border font-bold text-sm ${draft.bg === `ai:${aiUrl}` ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200"}`}
              >
                {draft.bg === `ai:${aiUrl}` ? "✓ 선택됨" : "이 배경 사용하기"}
              </button>
              <button onClick={() => { aiReset(); setAiPrompt(""); }} className="w-full h-10 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600">
                다시 생성하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 빈영역 탐지 테스트 (관리자 설정에서 노출 시에만 표시) */}
      {uiSettings.whitespace_test_enabled && (
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-600">🔍 빈영역 탐지 테스트</span>
          <button
            onClick={runWhitespaceTest}
            disabled={!draft.bg || wsLoading}
            className="rounded-lg bg-[#7b310d] px-3 py-1.5 text-xs font-bold text-white disabled:bg-stone-300"
          >
            {wsLoading ? "탐지 중..." : "탐지 실행"}
          </button>
        </div>
        {!draft.bg && <p className="mt-2 text-xs text-stone-400">먼저 배경을 선택하세요.</p>}
        {(wsPreviewSrc || wsPreviewSwatch) && (
          <div className="relative mx-auto mt-3 aspect-[2/3] w-44 overflow-hidden rounded-lg ring-1 ring-stone-200">
            {wsPreviewSrc ? (
              <SmoothImage src={wsPreviewSrc} alt="배경 미리보기" className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${wsPreviewSwatch}`} />
            )}
            {wsRegion && (
              <>
                <div
                  className="absolute border-2 border-[#ff0050] bg-[#ff0050]/20"
                  style={{
                    left: `${wsRegion.x0 * 100}%`,
                    top: `${wsRegion.y0 * 100}%`,
                    width: `${(wsRegion.x1 - wsRegion.x0) * 100}%`,
                    height: `${(wsRegion.y1 - wsRegion.y0) * 100}%`,
                  }}
                />
                <div
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0050]"
                  style={{ left: `${wsRegion.cx * 100}%`, top: `${wsRegion.cy * 100}%` }}
                />
              </>
            )}
          </div>
        )}
        {wsMeta && (
          <p className="mt-2 text-center text-[11px] font-semibold text-stone-500">
            {wsMeta.band} · 비어있음 {(wsMeta.emptiness * 100).toFixed(0)}% · 밝기 {(wsMeta.brightness * 100).toFixed(0)}% · 크기 {(wsMeta.wRatio * 100).toFixed(0)}×{(wsMeta.hRatio * 100).toFixed(0)}% · {wsMeta.ms}ms
          </p>
        )}
      </div>
      )}

      <div className="mt-6">
        <PrimaryButton onClick={() => router.push(messageHref)}>다음</PrimaryButton>
      </div>
    </PhoneShell>
  );
}

export function PreviewScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const useAi = searchParams.get("ai") === "1"; // 배경 화면의 "AI로 만들기" → AI 합성
  const [draft, setDraft, draftHydrated] = useDraft();
  const [adjTab, setAdjTab] = useState<"title" | "content" | "footer">("title");
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  const { addCard } = useSupabaseCards();
  const uiSettings = usePublicUiSettings();
  const enabledFonts = uiSettings.enabled_fonts && uiSettings.enabled_fonts.length > 0
    ? CARD_FONTS.filter((f) => uiSettings.enabled_fonts!.includes(f.id))
    : CARD_FONTS;
  const { hand_paper_enabled, hand_paper_style } = uiSettings;
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [debugPrompt, setDebugPrompt] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [typographyReady, setTypographyReady] = useState(false);
  const [whitespaceReady, setWhitespaceReady] = useState(false);
  // 텍스트 측정 기반 위치 보정이 끝났는지 여부. 보정 전까지 카드를 숨겨
  // "배치 후 위치조정" 점프가 보이지 않도록 한다.
  const [layoutSettled, setLayoutSettled] = useState(false);
  // 사진 필터 재생성 중 표시 ("적용중입니다" 스피너)
  const [filterApplying, setFilterApplying] = useState(false);
  const hasRenderedOnceRef = useRef(false);
  const [previewWsRegion, setPreviewWsRegion] = useState<WsRegion | null>(null);
  const [showTextBoxes, setShowTextBoxes] = useState(true);
  const [selectedTextBoxPart, setSelectedTextBoxPart] = useState<PreviewTextPart | null>("title");
  const [inlineEditingPart, setInlineEditingPart] = useState<PreviewTextPart | null>(null);
  const [inlineEditingInitialText, setInlineEditingInitialText] = useState("");
  const [cardPreviewScale, setCardPreviewScale] = useState(1);
  const typographyInitializedRef = useRef(false);
  const manuallyPositionedPartsRef = useRef<Set<PreviewTextPart>>(new Set());
  const undoStackRef = useRef<Draft[]>([]);
  const areaDragStartRef = useRef<{
    mode: "move" | "draw" | "rotate" | "resize-left" | "resize-right" | "resize-top" | "resize-bottom";
    part: PreviewTextPart;
    point: { x: number; y: number };
    box?: TextBox;
    startRotation?: number; // 회전 시작 시점의 각도
    startPointerAngle?: number; // 회전 시작 시점, 중심→포인터 각도
  } | null>(null);
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const inlineEditingValueRef = useRef("");
  const pendingInlineEditsRef = useRef<Partial<Record<PreviewTextPart, string>>>({});
  const cardPreviewRef = useRef<HTMLDivElement>(null);
  const previewTextRefs = useRef<Partial<Record<PreviewTextPart, HTMLDivElement>>>({});
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const pushUndoSnapshot = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), { ...draftRef.current }];
  }, []);

  const setDraftWithUndo = useCallback((next: Partial<Draft>) => {
    pushUndoSnapshot();
    setDraft(next);
  }, [pushUndoSnapshot, setDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const previous = undoStackRef.current.pop();
      if (!previous) return;
      event.preventDefault();
      setDraft(previous);
      setShowTextBoxes(true);
      setSelectedTextBoxPart(adjTab);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjTab, setDraft]);

  useEffect(() => {
    const preview = cardPreviewRef.current;
    if (!preview) return;
    const updateScale = () => setCardPreviewScale(preview.getBoundingClientRect().width / CARD_PREVIEW_WIDTH);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [cardImageUrl]);

  useEffect(() => {
    if (!draftHydrated) return;
    let cancelled = false;
    setWhitespaceReady(false);
    setPreviewWsRegion(null);
    if (!draft.bg) {
      setWhitespaceReady(true);
      return;
    }
    // 빈공간 탐지는 배경 사진 자체에만 의존한다. (필터는 색감만 바꾸므로 글씨 위치를 바꾸지 않도록 bgFilter 제외)
    fetch("/api/whitespace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bg: draft.bg, bg_filter: "none" }),
    })
      .then((res) => res.json())
      .then((data: { region?: WsRegion }) => {
        if (!cancelled) setPreviewWsRegion(data.region ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreviewWsRegion(null);
      })
      .finally(() => {
        if (!cancelled) setWhitespaceReady(true);
      });
    return () => { cancelled = true; };
  }, [draft.bg, draftHydrated]);

  useEffect(() => {
    if (!draftHydrated || !whitespaceReady) return;
    if (useAi) {
      setTypographyReady(true);
      return;
    }
    if (typographyInitializedRef.current) return;
    typographyInitializedRef.current = true;
    manuallyPositionedPartsRef.current.clear();
    const typography = getRecommendedTypography(draft);
    const defaultBoxes = applyWhitespaceRegionToBoxes(getDefaultPartTextBoxes("auto", draft), previewWsRegion);
    const hasTitle = Boolean(draft.title?.trim());
    const hasFooter = Boolean(draft.footer?.trim() || (draft.authorEnabled && draft.author?.trim()));
    // 제목이 없으면(내용만 있는 카드) 미리보기 진입 시 "내용" 탭이 선택되도록.
    const initialPart: PreviewTextPart = hasTitle ? "title" : "content";
    setAdjTab(initialPart);
    setSelectedTextBoxPart(initialPart);
    setDraft({
      titleFont: typography.titleFont,
      contentFont: typography.contentFont,
      titleScale: typography.titleScale,
      contentScale: typography.contentScale,
      contentRotation: undefined,
      cardPosition: "auto",
      titleTextBox: hasTitle ? defaultBoxes.titleTextBox : undefined,
      contentTextBox: defaultBoxes.contentTextBox,
      footerTextBox: hasFooter ? defaultBoxes.footerTextBox : undefined,
    });
    setTypographyReady(true);
  }, [draftHydrated, draft, previewWsRegion, setDraft, useAi, whitespaceReady]);

  const getResolvedTextBoxes = useCallback((source: Draft): DefaultTextBoxes => {
    const defaultBoxes = applyWhitespaceRegionToBoxes(getDefaultPartTextBoxes(source.cardPosition, source), previewWsRegion);
    const hasTitle = Boolean(source.title?.trim());
    const hasFooter = Boolean(source.footer?.trim() || (source.authorEnabled && source.author?.trim()));
    return {
      titleTextBox: hasTitle ? source.titleTextBox ?? defaultBoxes.titleTextBox : defaultBoxes.titleTextBox,
      contentTextBox: source.contentTextBox ?? source.textBox ?? defaultBoxes.contentTextBox,
      footerTextBox: hasFooter ? source.footerTextBox ?? defaultBoxes.footerTextBox : defaultBoxes.footerTextBox,
    };
  }, [previewWsRegion]);

  const createCardImage = useCallback(async (
    useAI = false,
    mode?: "sub" | "pay",
    signal?: AbortSignal,
    omitTextPart?: PreviewTextPart,
    sourceDraft?: Draft,
  ): Promise<{ url: string; blob: Blob; boxes: DefaultTextBoxes; textMetrics: PreviewTextMetrics | null }> => {
    const d = sourceDraft ?? draftRef.current;
    const recommendedTypography = getRecommendedTypography(d);
    const resolvedBoxes = getResolvedTextBoxes(d);
    // 하단 메세지 + 작성자 → 카드 하단 추가 문구
    const subText = [
      d.footer?.trim(),
      d.authorEnabled && d.author?.trim() ? `- ${d.author.trim()}` : "",
    ].filter(Boolean).join("\n") || undefined;
    const res = await fetch("/api/card-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.title || "",
          message: d.message || "당신을 응원합니다. 오늘도 행복하세요.",
          bg: d.bg || "flower",
          bg_filter: d.bgFilter || "none",
          purpose: d.purpose || "love",
          hand_font: d.handFont,
          hand_tone: d.handTone,
          hand_mode: d.handMode,
          hand_paper_style,
          hand_paper_enabled,
          recipient_label: d.title || "", // 제목(받는분 대체)
          ai_compose: useAI,
          api_mode: mode,
          // 미리보기 수동 조정
          title_font: d.titleFont ?? recommendedTypography.titleFont,
          content_font: d.contentFont ?? recommendedTypography.contentFont,
          footer_font: d.footerFont ?? d.contentFont ?? recommendedTypography.contentFont,
          position: d.cardPosition,
          title_scale: d.titleScale ?? recommendedTypography.titleScale,
          content_scale: d.contentScale ?? recommendedTypography.contentScale,
          footer_scale: d.footerScale ?? DEFAULT_FOOTER_SCALE,
          title_color: d.titleColor,
          content_color: d.contentColor,
          footer_color: d.footerColor,
          sub_text: subText,
          text_box: d.textBox,
          title_box: d.title?.trim() ? resolvedBoxes.titleTextBox : undefined,
          content_box: resolvedBoxes.contentTextBox,
          footer_box: subText ? resolvedBoxes.footerTextBox : undefined,
          title_rotation: d.titleRotation ?? 0,
          content_rotation: d.contentRotation ?? 0,
          footer_rotation: d.footerRotation ?? 0,
          omit_text_part: omitTextPart,
          title_bold: d.titleBold,
          content_bold: d.contentBold,
          content_align: d.contentAlign,
          footer_bold: d.footerBold,
      }),
      signal,
    });
    if (!res.ok) throw new Error("card image failed");
    const promptHeader = res.headers.get("X-AI-Prompt");
    if (promptHeader) setDebugPrompt(decodeURIComponent(promptHeader));
    const metricsHeader = res.headers.get("X-Card-Text-Metrics");
    const textMetrics = metricsHeader ? JSON.parse(decodeURIComponent(metricsHeader)) as PreviewTextMetrics : null;
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), blob, boxes: resolvedBoxes, textMetrics };
  }, [getResolvedTextBoxes, hand_paper_enabled, hand_paper_style]);

  const createBackgroundImage = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/card-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bg: draftRef.current.bg || "flower", bg_filter: draft.bgFilter || "none", background_only: true }),
      signal,
    });
    if (!res.ok) throw new Error("card background failed");
    return URL.createObjectURL(await res.blob());
  }, [draft.bgFilter]);

  // AI(OpenAI) 감성 합성은 백엔드 모듈(card-ai-compose)로 분리됨.
  // 프론트에서 다시 노출하려면 createCardImage(true, "sub")를 버튼에 연결.

  useEffect(() => {
    if (!draftHydrated || !typographyReady || !whitespaceReady) return;
    const abortController = new AbortController();
    const loadPreview = async () => {
      // 첫 로드가 아니면(필터 변경 등 재생성) "적용중" 스피너 표시
      const isRegen = hasRenderedOnceRef.current;
      if (isRegen) setFilterApplying(true);
      try {
        const imageUrl = await createBackgroundImage(abortController.signal);
        if (abortController.signal.aborted) return;
        setCardImageUrl(imageUrl);
        hasRenderedOnceRef.current = true;
        setProgress(100);
        setDone(true);
      } catch {
        if (abortController.signal.aborted) return;
        setGenerationError("카드 배경을 불러오지 못했습니다. 다시 시도해주세요.");
        setProgress(100);
        setDone(true);
      } finally {
        if (!abortController.signal.aborted) setFilterApplying(false);
      }
    };
    void loadPreview();

    return () => {
      abortController.abort();
    };
  }, [createBackgroundImage, draftHydrated, typographyReady, whitespaceReady]);

  // 생성 시작부터 뒤로가기 차단 — 홈으로 보냄 (진행 중 이탈 시 API 낭비 방지)
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => router.replace("/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router]);

  const finalizeCard = useCallback(async (destination?: "/library") => {
    if (finalizing) return;
    let finalDraft = {
      ...readJson<Draft>(draftStorageKey, draftRef.current),
      ...draftRef.current,
    };
    const pendingEdits = { ...pendingInlineEditsRef.current };
    if (inlineEditingPart) {
      pendingEdits[inlineEditingPart] = inlineEditorRef.current
        ? readEditableText(inlineEditorRef.current)
        : inlineEditingValueRef.current;
    }
    const pendingUpdate: Partial<Draft> = {};
    if (pendingEdits.title !== undefined) pendingUpdate.title = pendingEdits.title;
    if (pendingEdits.footer !== undefined) pendingUpdate.footer = pendingEdits.footer;
    if (pendingEdits.content !== undefined) {
      pendingUpdate.message = pendingEdits.content;
      pendingUpdate.messageOrigin = "direct";
    }
    finalDraft = { ...finalDraft, ...pendingUpdate };
    if (Object.keys(pendingUpdate).length > 0) setDraft(pendingUpdate);
    setInlineEditingPart(null);
    draftRef.current = finalDraft;
    writeJson(draftStorageKey, finalDraft);
    setFinalizing(true);
    try {
      const { blob } = await createCardImage(
        useAi,
        useAi ? "sub" : undefined,
        undefined,
        undefined,
        finalDraft,
      );
      const cardId = await addCard(finalDraft, blob);
      pendingInlineEditsRef.current = {};
      if (destination) router.push(destination);
      return cardId;
    } catch (error) {
      console.error("카드 보관함 저장 실패:", error);
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      window.alert(`카드 저장에 실패했습니다.\n${message}`);
      return null;
    } finally {
      setFinalizing(false);
    }
  }, [addCard, createCardImage, finalizing, inlineEditingPart, router, setDraft, useAi]);

  const getTextAreaPoint = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clampUnit((event.clientX - rect.left) / rect.width),
      y: clampUnit((event.clientY - rect.top) / rect.height),
    };
  }, []);

  const getPartTextBox = useCallback((source: Draft, part: PreviewTextPart) => {
    if (part === "title") return source.titleTextBox ?? getDefaultPartTextBox("title", source.cardPosition, source);
    if (part === "footer") return source.footerTextBox ?? getDefaultPartTextBox("footer", source.cardPosition, source);
    return source.contentTextBox ?? source.textBox ?? getDefaultPartTextBox("content", source.cardPosition, source);
  }, []);

  const setPartTextBox = useCallback((part: PreviewTextPart, box: TextBox) => {
    manuallyPositionedPartsRef.current.add(part);
    if (part === "title") setDraft({ titleTextBox: box, cardPosition: "auto" });
    else if (part === "footer") setDraft({ footerTextBox: box, cardPosition: "auto" });
    else setDraft({ contentTextBox: box, textBox: box, cardPosition: "auto" });
  }, [setDraft]);

  const getPartRotation = useCallback((source: Draft, part: PreviewTextPart) => {
    if (part === "title") return source.titleRotation ?? 0;
    if (part === "footer") return source.footerRotation ?? 0;
    return source.contentRotation ?? 0;
  }, []);

  const setPartRotation = useCallback((part: PreviewTextPart, rotation: number) => {
    const normalized = Math.round(clampRange(rotation, -45, 45));
    if (part === "title") setDraft({ titleRotation: normalized });
    else if (part === "footer") setDraft({ footerRotation: normalized });
    else setDraft({ contentRotation: normalized });
  }, [setDraft]);

  const adjustPartFontScale = useCallback((part: PreviewTextPart, delta: number) => {
    const currentDraft = draftRef.current;
    const typography = getRecommendedTypography(currentDraft);
    const key = part === "title" ? "titleScale" : part === "footer" ? "footerScale" : "contentScale";
    const fallback = part === "title" ? typography.titleScale : part === "footer" ? DEFAULT_FOOTER_SCALE : typography.contentScale;
    const current = (currentDraft[key] as number | undefined) ?? fallback;
    const nextScale = Math.round(clampRange(current + delta, 0.6, 1.8) * 20) / 20;
    if (nextScale === current) return;

    const boxes = {
      title: getPartTextBox(currentDraft, "title"),
      content: getPartTextBox(currentDraft, "content"),
      footer: getPartTextBox(currentDraft, "footer"),
    };
    const selected = boxes[part];
    const ratio = nextScale / current;
    const widthRatio = Math.pow(ratio, 0.72);
    const heightRatio = ratio;
    const centerX = (selected.x0 + selected.x1) / 2;
    const centerY = (selected.y0 + selected.y1) / 2;
    const nextWidth = clampRange((selected.x1 - selected.x0) * widthRatio, part === "content" ? 0.24 : 0.18, 0.9);
    const nextHeight = clampRange((selected.y1 - selected.y0) * heightRatio, 0.055, part === "content" ? 0.42 : 0.2);
    boxes[part] = {
      x0: clampRange(centerX - nextWidth / 2, 0.04, 0.96 - nextWidth),
      y0: clampRange(centerY - nextHeight / 2, 0.04, 0.96 - nextHeight),
      x1: 0,
      y1: 0,
    };
    boxes[part].x1 = boxes[part].x0 + nextWidth;
    boxes[part].y1 = boxes[part].y0 + nextHeight;

    const gap = 0.025;
    const hasTitle = Boolean(currentDraft.title?.trim());
    const hasFooter = Boolean(currentDraft.footer?.trim() || (currentDraft.authorEnabled && currentDraft.author?.trim()));

    if (part === "title" && hasTitle) {
      const shift = boxes.title.y1 + gap - boxes.content.y0;
      if (shift > 0) {
        boxes.content = { ...boxes.content, y0: boxes.content.y0 + shift, y1: boxes.content.y1 + shift };
        if (hasFooter) boxes.footer = { ...boxes.footer, y0: boxes.footer.y0 + shift, y1: boxes.footer.y1 + shift };
      }
    } else if (part === "content") {
      if (hasTitle) {
        const shift = boxes.title.y1 + gap - boxes.content.y0;
        if (shift > 0) boxes.title = { ...boxes.title, y0: boxes.title.y0 - shift, y1: boxes.title.y1 - shift };
      }
      if (hasFooter) {
        const shift = boxes.content.y1 + gap - boxes.footer.y0;
        if (shift > 0) boxes.footer = { ...boxes.footer, y0: boxes.footer.y0 + shift, y1: boxes.footer.y1 + shift };
      }
    } else if (part === "footer" && hasFooter) {
      const shift = boxes.content.y1 + gap - boxes.footer.y0;
      if (shift > 0) {
        boxes.content = { ...boxes.content, y0: boxes.content.y0 - shift, y1: boxes.content.y1 - shift };
        if (hasTitle) boxes.title = { ...boxes.title, y0: boxes.title.y0 - shift, y1: boxes.title.y1 - shift };
      }
    }

    const visibleBoxes = [
      ...(hasTitle ? [boxes.title] : []),
      boxes.content,
      ...(hasFooter ? [boxes.footer] : []),
    ];
    const groupTop = Math.min(...visibleBoxes.map((box) => box.y0));
    const groupBottom = Math.max(...visibleBoxes.map((box) => box.y1));
    const groupShiftY = groupTop < 0.04 ? 0.04 - groupTop : groupBottom > 0.96 ? 0.96 - groupBottom : 0;
    if (groupShiftY) {
      (["title", "content", "footer"] as PreviewTextPart[]).forEach((boxPart) => {
        boxes[boxPart] = {
          ...boxes[boxPart],
          y0: boxes[boxPart].y0 + groupShiftY,
          y1: boxes[boxPart].y1 + groupShiftY,
        };
      });
    }

    manuallyPositionedPartsRef.current.add("title");
    manuallyPositionedPartsRef.current.add("content");
    manuallyPositionedPartsRef.current.add("footer");
    setDraftWithUndo({
      [key]: nextScale,
      titleTextBox: boxes.title,
      contentTextBox: boxes.content,
      textBox: boxes.content,
      footerTextBox: boxes.footer,
    });
  }, [getPartTextBox, setDraftWithUndo]);

  const beginInlineEditing = useCallback((part: PreviewTextPart, caretPoint?: { clientX: number; clientY: number }) => {
    setAdjTab(part);
    setShowTextBoxes(true);
    setSelectedTextBoxPart(part);
    const currentDraft = draftRef.current;
    const initialText = part === "title" ? currentDraft.title ?? ""
      : part === "content" ? currentDraft.message ?? ""
      : currentDraft.footer ?? "";
    inlineEditingValueRef.current = initialText;
    pendingInlineEditsRef.current[part] = initialText;
    setInlineEditingInitialText(initialText);
    setInlineEditingPart(part);
    window.requestAnimationFrame(() => {
      const editor = inlineEditorRef.current;
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      let range: Range | null = null;
      if (caretPoint) {
        const caretPosition = document.caretPositionFromPoint?.(caretPoint.clientX, caretPoint.clientY);
        if (caretPosition && editor.contains(caretPosition.offsetNode)) {
          range = document.createRange();
          range.setStart(caretPosition.offsetNode, caretPosition.offset);
          range.collapse(true);
        } else {
          const legacyDocument = document as Document & {
            caretRangeFromPoint?: (x: number, y: number) => Range | null;
          };
          const legacyRange = legacyDocument.caretRangeFromPoint?.(caretPoint.clientX, caretPoint.clientY) ?? null;
          if (legacyRange && editor.contains(legacyRange.startContainer)) range = legacyRange;
        }
      }
      if (!range) {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }, []);

  const endInlineEditing = useCallback(() => {
    const part = inlineEditingPart;
    const value = inlineEditingValueRef.current;
    const update: Partial<Draft> = part === "title"
      ? { title: value }
      : part === "footer"
        ? { footer: value }
        : part === "content"
          ? { message: value, messageOrigin: "direct" }
          : {};
    if (part) {
      const nextDraft = { ...draftRef.current, ...update };
      draftRef.current = nextDraft;
      writeJson(draftStorageKey, nextDraft);
      pendingInlineEditsRef.current[part] = value;
      setDraft(update);
    }
    setInlineEditingPart(null);
  }, [inlineEditingPart, setDraft]);

  // 회전마크는 박스 우측 하단(se 코너)에 위치하며, 박스가 회전하면 마크도 중심 기준으로 함께 회전한다.
  // 따라서 히트 판정도 회전을 반영한 마크의 실제 위치(픽셀 기준)로 계산해야 한다.
  const isNearRotateHandle = useCallback((point: { x: number; y: number }, box: TextBox, rotation: number) => {
    const W = CARD_PREVIEW_WIDTH;
    const H = CARD_PREVIEW_HEIGHT;
    const cx = ((box.x0 + box.x1) / 2) * W;
    const cy = ((box.y0 + box.y1) / 2) * H;
    const rad = (rotation * Math.PI) / 180;
    const ox = box.x1 * W - cx;
    const oy = box.y1 * H - cy;
    const hx = ox * Math.cos(rad) - oy * Math.sin(rad) + cx;
    const hy = ox * Math.sin(rad) + oy * Math.cos(rad) + cy;
    return Math.hypot(point.x * W - hx, point.y * H - hy) <= 70;
  }, []);

  const getHorizontalResizeHandle = useCallback((
    point: { x: number; y: number },
    box: TextBox,
    rotation: number,
  ): "resize-left" | "resize-right" | null => {
    const width = CARD_PREVIEW_WIDTH;
    const height = CARD_PREVIEW_HEIGHT;
    const cx = ((box.x0 + box.x1) / 2) * width;
    const cy = ((box.y0 + box.y1) / 2) * height;
    const rad = (rotation * Math.PI) / 180;
    const rotatePoint = (x: number, y: number) => {
      const ox = x - cx;
      const oy = y - cy;
      return {
        x: ox * Math.cos(rad) - oy * Math.sin(rad) + cx,
        y: ox * Math.sin(rad) + oy * Math.cos(rad) + cy,
      };
    };
    const pointer = { x: point.x * width, y: point.y * height };
    const left = rotatePoint(box.x0 * width, cy);
    const right = rotatePoint(box.x1 * width, cy);
    const threshold = 42;
    if (Math.hypot(pointer.x - left.x, pointer.y - left.y) <= threshold) return "resize-left";
    if (Math.hypot(pointer.x - right.x, pointer.y - right.y) <= threshold) return "resize-right";
    return null;
  }, []);

  const getVerticalResizeHandle = useCallback((
    point: { x: number; y: number },
    box: TextBox,
    rotation: number,
  ): "resize-top" | "resize-bottom" | null => {
    const width = CARD_PREVIEW_WIDTH;
    const height = CARD_PREVIEW_HEIGHT;
    const cx = ((box.x0 + box.x1) / 2) * width;
    const cy = ((box.y0 + box.y1) / 2) * height;
    const rad = (rotation * Math.PI) / 180;
    const rotatePoint = (x: number, y: number) => {
      const ox = x - cx;
      const oy = y - cy;
      return {
        x: ox * Math.cos(rad) - oy * Math.sin(rad) + cx,
        y: ox * Math.sin(rad) + oy * Math.cos(rad) + cy,
      };
    };
    const pointer = { x: point.x * width, y: point.y * height };
    const top = rotatePoint(cx, box.y0 * height);
    const bottom = rotatePoint(cx, box.y1 * height);
    const threshold = 42;
    if (Math.hypot(pointer.x - top.x, pointer.y - top.y) <= threshold) return "resize-top";
    if (Math.hypot(pointer.x - bottom.x, pointer.y - bottom.y) <= threshold) return "resize-bottom";
    return null;
  }, []);

  const resetActiveTextBox = useCallback(() => {
    pushUndoSnapshot();
    setShowTextBoxes(true);
    setSelectedTextBoxPart(adjTab);
    manuallyPositionedPartsRef.current.delete(adjTab);
    if (adjTab === "title") setDraft({ titleTextBox: undefined });
    else if (adjTab === "footer") setDraft({ footerTextBox: undefined });
    else setDraft({ contentTextBox: undefined, textBox: undefined });
  }, [adjTab, pushUndoSnapshot, setDraft]);

  const deleteTextPart = useCallback((part: "title" | "footer") => {
    if (inlineEditingPart === part) endInlineEditing();
    if (part === "title") {
      manuallyPositionedPartsRef.current.delete("title");
      setDraftWithUndo({
        title: "",
        titleTextBox: undefined,
        titleRotation: undefined,
      });
      setAdjTab("content");
      setSelectedTextBoxPart("content");
      return;
    }
    manuallyPositionedPartsRef.current.delete("footer");
    setDraftWithUndo({
      footer: "",
      author: "",
      authorEnabled: false,
      footerTextBox: undefined,
      footerRotation: undefined,
    });
    setAdjTab("content");
    setSelectedTextBoxPart("content");
  }, [endInlineEditing, inlineEditingPart, setDraftWithUndo]);

  const handleTextAreaPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (useAi) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getTextAreaPoint(event);
    const currentDraft = draftRef.current;
    const selectedBox = selectedTextBoxPart ? getPartTextBox(currentDraft, selectedTextBoxPart) : null;
    const selectedRotation = selectedTextBoxPart ? getPartRotation(currentDraft, selectedTextBoxPart) : 0;
    const resizeMode = selectedTextBoxPart === "content" && selectedBox
      ? getHorizontalResizeHandle(point, selectedBox, selectedRotation)
      : null;
    if (resizeMode && selectedBox) {
      pushUndoSnapshot();
      setShowTextBoxes(true);
      areaDragStartRef.current = {
        mode: resizeMode,
        part: "content",
        point,
        box: selectedBox,
      };
      return;
    }
    const verticalResizeMode = selectedBox
      ? getVerticalResizeHandle(point, selectedBox, selectedRotation)
      : null;
    if (verticalResizeMode && selectedBox && selectedTextBoxPart) {
      pushUndoSnapshot();
      setShowTextBoxes(true);
      areaDragStartRef.current = {
        mode: verticalResizeMode,
        part: selectedTextBoxPart,
        point,
        box: selectedBox,
      };
      return;
    }
    if (selectedBox && isNearRotateHandle(point, selectedBox, selectedRotation)) {
      pushUndoSnapshot();
      setShowTextBoxes(true);
      const cx = (selectedBox.x0 + selectedBox.x1) / 2;
      const cy = (selectedBox.y0 + selectedBox.y1) / 2;
      areaDragStartRef.current = {
        mode: "rotate",
        part: selectedTextBoxPart!,
        point,
        box: selectedBox,
        startRotation: getPartRotation(currentDraft, selectedTextBoxPart!),
        startPointerAngle: Math.atan2((point.y - cy) * CARD_PREVIEW_HEIGHT, (point.x - cx) * CARD_PREVIEW_WIDTH) * 180 / Math.PI,
      };
      return;
    }
    const hitOrder = selectedTextBoxPart
      ? ([selectedTextBoxPart, ...(["title", "content", "footer"] as PreviewTextPart[]).filter((part) => part !== selectedTextBoxPart)] as PreviewTextPart[])
      : (["title", "content", "footer"] as PreviewTextPart[]);
    const hit = hitOrder
      .map((part) => ({ part, box: getPartTextBox(currentDraft, part) }))
      .find(({ box }) => point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1);
    if (!hit) {
      if (inlineEditingPart) endInlineEditing();
      setShowTextBoxes(false);
      setSelectedTextBoxPart(null);
      areaDragStartRef.current = null;
      return;
    }
    pushUndoSnapshot();
    setShowTextBoxes(true);
    setSelectedTextBoxPart(hit.part);
    const part = hit?.part ?? adjTab;
    const box = hit?.box ?? getPartTextBox(currentDraft, part);
    if (part !== adjTab) setAdjTab(part);

    
    areaDragStartRef.current = { mode: "move", part, point, box };
  }, [adjTab, endInlineEditing, getHorizontalResizeHandle, getPartRotation, getPartTextBox, getTextAreaPoint, getVerticalResizeHandle, inlineEditingPart, isNearRotateHandle, pushUndoSnapshot, selectedTextBoxPart, useAi]);

  const handleTextAreaPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (useAi || !areaDragStartRef.current) return;
    event.preventDefault();
    const drag = areaDragStartRef.current;
    const point = getTextAreaPoint(event);
    if (drag.mode === "rotate" && drag.box) {
      const cx = (drag.box.x0 + drag.box.x1) / 2;
      const cy = (drag.box.y0 + drag.box.y1) / 2;
      const currentAngle = Math.atan2((point.y - cy) * CARD_PREVIEW_HEIGHT, (point.x - cx) * CARD_PREVIEW_WIDTH) * 180 / Math.PI;
      const delta = currentAngle - (drag.startPointerAngle ?? currentAngle);
      setPartRotation(drag.part, (drag.startRotation ?? 0) + delta);
      return;
    }
    if (drag.mode === "move" && drag.box) {
      const dx = point.x - drag.point.x;
      const dy = point.y - drag.point.y;
      const width = drag.box.x1 - drag.box.x0;
      const height = drag.box.y1 - drag.box.y0;
      const x0 = clampUnit(Math.min(1 - width, Math.max(0, drag.box.x0 + dx)));
      const y0 = clampUnit(Math.min(1 - height, Math.max(0, drag.box.y0 + dy)));
      setPartTextBox(drag.part, { x0, y0, x1: x0 + width, y1: y0 + height });
      return;
    }
    if ((drag.mode === "resize-left" || drag.mode === "resize-right") && drag.box) {
      const minWidth = 0.24;
      const nextBox = drag.mode === "resize-left"
        ? { ...drag.box, x0: clampRange(point.x, 0, drag.box.x1 - minWidth) }
        : { ...drag.box, x1: clampRange(point.x, drag.box.x0 + minWidth, 1) };
      setPartTextBox(drag.part, nextBox);
      return;
    }
    if ((drag.mode === "resize-top" || drag.mode === "resize-bottom") && drag.box) {
      const minHeight = 0.055;
      const nextBox = drag.mode === "resize-top"
        ? { ...drag.box, y0: clampRange(point.y, 0, drag.box.y1 - minHeight) }
        : { ...drag.box, y1: clampRange(point.y, drag.box.y0 + minHeight, 1) };
      setPartTextBox(drag.part, nextBox);
      return;
    }
    setPartTextBox(drag.part, normalizeTextBox(drag.point, point));
  }, [getTextAreaPoint, setPartRotation, setPartTextBox, useAi]);

  const handleTextAreaPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (useAi || !areaDragStartRef.current) return;
    event.preventDefault();
    const drag = areaDragStartRef.current;
    const point = getTextAreaPoint(event);
    const movedPx = Math.hypot(
      (point.x - drag.point.x) * CARD_PREVIEW_WIDTH,
      (point.y - drag.point.y) * CARD_PREVIEW_HEIGHT,
    );
    if (drag.mode === "rotate" && drag.box) {
      const cx = (drag.box.x0 + drag.box.x1) / 2;
      const cy = (drag.box.y0 + drag.box.y1) / 2;
      const currentAngle = Math.atan2((point.y - cy) * CARD_PREVIEW_HEIGHT, (point.x - cx) * CARD_PREVIEW_WIDTH) * 180 / Math.PI;
      const delta = currentAngle - (drag.startPointerAngle ?? currentAngle);
      setPartRotation(drag.part, (drag.startRotation ?? 0) + delta);
    } else if (drag.mode === "move" && drag.box) {
      const dx = point.x - drag.point.x;
      const dy = point.y - drag.point.y;
      const width = drag.box.x1 - drag.box.x0;
      const height = drag.box.y1 - drag.box.y0;
      const x0 = clampUnit(Math.min(1 - width, Math.max(0, drag.box.x0 + dx)));
      const y0 = clampUnit(Math.min(1 - height, Math.max(0, drag.box.y0 + dy)));
      setPartTextBox(drag.part, { x0, y0, x1: x0 + width, y1: y0 + height });
      if (movedPx < 6) void beginInlineEditing(drag.part);
    } else if ((drag.mode === "resize-left" || drag.mode === "resize-right") && drag.box) {
      const minWidth = 0.24;
      const nextBox = drag.mode === "resize-left"
        ? { ...drag.box, x0: clampRange(point.x, 0, drag.box.x1 - minWidth) }
        : { ...drag.box, x1: clampRange(point.x, drag.box.x0 + minWidth, 1) };
      setPartTextBox(drag.part, nextBox);
    } else if ((drag.mode === "resize-top" || drag.mode === "resize-bottom") && drag.box) {
      const minHeight = 0.055;
      const nextBox = drag.mode === "resize-top"
        ? { ...drag.box, y0: clampRange(point.y, 0, drag.box.y1 - minHeight) }
        : { ...drag.box, y1: clampRange(point.y, drag.box.y0 + minHeight, 1) };
      setPartTextBox(drag.part, nextBox);
    } else {
      setPartTextBox(drag.part, normalizeTextBox(drag.point, point));
    }
    areaDragStartRef.current = null;
  }, [beginInlineEditing, getTextAreaPoint, setPartRotation, setPartTextBox, useAi]);

  const focusTextEditor = useCallback((part: PreviewTextPart) => {
    void beginInlineEditing(part);
  }, [beginInlineEditing]);

  const handlePreviewDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (useAi) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: clampUnit((event.clientX - rect.left) / rect.width),
      y: clampUnit((event.clientY - rect.top) / rect.height),
    };
    const currentDraft = draftRef.current;
    const hitOrder = selectedTextBoxPart
      ? ([selectedTextBoxPart, ...(["title", "content", "footer"] as PreviewTextPart[]).filter((part) => part !== selectedTextBoxPart)] as PreviewTextPart[])
      : (["title", "content", "footer"] as PreviewTextPart[]);
    const hitPart = hitOrder.find((part) => {
      const box = getPartTextBox(currentDraft, part);
      return point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1;
    });
    void beginInlineEditing(hitPart ?? selectedTextBoxPart ?? adjTab, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [adjTab, beginInlineEditing, getPartTextBox, selectedTextBoxPart, useAi]);

  const handlePreviewKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (useAi || event.key !== "Enter") return;
    event.preventDefault();
    focusTextEditor(selectedTextBoxPart ?? adjTab);
  }, [adjTab, focusTextEditor, selectedTextBoxPart, useAi]);

  const hasCustomActiveTextBox =
    adjTab === "title" ? Boolean(draft.titleTextBox)
    : adjTab === "footer" ? Boolean(draft.footerTextBox)
    : Boolean(draft.contentTextBox || draft.textBox);
  const activeRotation = getPartRotation(draft, adjTab);
  const overlayBoxes = getResolvedTextBoxes(draft);
  const availableTextBox: TextBox = previewWsRegion
    ? {
        x0: clampRange(previewWsRegion.x0 - 0.035, 0.055, 0.72),
        y0: clampRange(previewWsRegion.y0 - 0.035, 0.06, 0.72),
        x1: clampRange(previewWsRegion.x1 + 0.035, 0.28, 0.945),
        y1: clampRange(previewWsRegion.y1 + 0.035, 0.28, 0.94),
      }
    : { x0: 0.075, y0: 0.08, x1: 0.925, y1: 0.92 };
  const previewTextBoxes = (["title", "content", "footer"] as PreviewTextPart[]).map((part) => ({
    part,
    box: part === "title" ? overlayBoxes.titleTextBox : part === "footer" ? overlayBoxes.footerTextBox : overlayBoxes.contentTextBox,
    rotation: getPartRotation(draft, part),
    label: part === "title" ? "TITLE" : part === "content" ? "BODY" : "FOOTER",
  })).filter(({ part }) => {
    if (part === "content") return true;
    if (part === "title") return inlineEditingPart === part || Boolean(draft.title?.trim());
    return inlineEditingPart === part || Boolean(draft.footer?.trim() || (draft.authorEnabled && draft.author?.trim()));
  });

  useEffect(() => {
    if (!done || !cardPreviewRef.current || inlineEditingPart) return;
    let cancelled = false;
    const measure = async () => {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (cancelled || !cardPreviewRef.current) return;
      const previewRect = cardPreviewRef.current.getBoundingClientRect();
      if (!previewRect.width || !previewRect.height) return;
      // 측정 가능한 시점 도달 → 아래 setDraft(보정)와 같은 커밋으로 묶여
      // 카드가 처음 보일 때 이미 확정된 위치로 렌더된다.
      if (!cancelled) setLayoutSettled(true);

      const visibleParts: PreviewTextPart[] = [
        ...(draftRef.current.title?.trim() ? ["title" as const] : []),
        "content",
        ...(draftRef.current.footer?.trim() || (draftRef.current.authorEnabled && draftRef.current.author?.trim())
          ? ["footer" as const]
          : []),
      ];
      const measured = visibleParts.map((part) => {
        const element = previewTextRefs.current[part];
        if (!element) return null;
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRect = range.getBoundingClientRect();
        const minWidth = part === "content" ? 0.26 : 0.2;
        const maxWidth = part === "content" ? 0.82 : part === "footer" ? 0.62 : 0.7;
        const minHeight = part === "content" ? 0.065 : 0.055;
        const width = clampRange((textRect.width + 24) / previewRect.width, minWidth, maxWidth);
        const height = clampRange((textRect.height + 18) / previewRect.height, minHeight, part === "content" ? 0.38 : 0.18);
        return {
          part,
          width,
          height,
        };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (!measured.length) return;

      const titleMetric = measured.find(({ part }) => part === "title");
      const bodyMetric = measured.find(({ part }) => part === "content");
      const footerMetric = measured.find(({ part }) => part === "footer");
      if (!bodyMetric) return;
      const totalHeight = bodyMetric.height + (titleMetric?.height ?? 0) + (footerMetric?.height ?? 0);
      const availableCenterY = (availableTextBox.y0 + availableTextBox.y1) / 2;
      const groupTop = clampRange(
        availableCenterY - totalHeight / 2,
        0.055,
        Math.max(0.055, 0.945 - totalHeight),
      );
      const bodyY0 = groupTop + (titleMetric?.height ?? 0);
      const bodyWidth = Math.min(bodyMetric.width, availableTextBox.x1 - availableTextBox.x0);
      const bodyCenterX = clampRange(
        previewWsRegion?.cx ?? (availableTextBox.x0 + availableTextBox.x1) / 2,
        availableTextBox.x0 + bodyWidth / 2,
        availableTextBox.x1 - bodyWidth / 2,
      );
      const bodyX0 = bodyCenterX - bodyWidth / 2;
      const bodyBox: TextBox = {
        x0: bodyX0,
        y0: bodyY0,
        x1: bodyX0 + bodyWidth,
        y1: bodyY0 + bodyMetric.height,
      };
      const next: Partial<Draft> = {};

      if (!manuallyPositionedPartsRef.current.has("content")) {
        next.contentTextBox = bodyBox;
        next.textBox = bodyBox;
      }
      if (titleMetric && !manuallyPositionedPartsRef.current.has("title")) {
        const titleWidth = Math.min(titleMetric.width, availableTextBox.x1 - availableTextBox.x0);
        const titleX0 = clampRange(bodyCenterX - titleWidth / 2, 0.055, 0.945 - titleWidth);
        next.titleTextBox = {
          x0: titleX0,
          y0: bodyBox.y0 - titleMetric.height,
          x1: titleX0 + titleWidth,
          y1: bodyBox.y0,
        };
      }
      if (footerMetric && !manuallyPositionedPartsRef.current.has("footer")) {
        const footerWidth = Math.min(footerMetric.width, bodyBox.x1 - 0.055);
        const footerX1 = bodyBox.x1;
        next.footerTextBox = {
          x0: footerX1 - footerWidth,
          y0: bodyBox.y1,
          x1: footerX1,
          y1: bodyBox.y1 + footerMetric.height,
        };
      }

      const changed = measured.some(({ part }) => {
        if (manuallyPositionedPartsRef.current.has(part)) return false;
        const before = getPartTextBox(draftRef.current, part);
        const after = part === "title" ? next.titleTextBox : part === "footer" ? next.footerTextBox : next.contentTextBox;
        return Boolean(after) && (
          Math.abs(before.x0 - after!.x0) > 0.002
          || Math.abs(before.y0 - after!.y0) > 0.002
          || Math.abs(before.x1 - after!.x1) > 0.002
          || Math.abs(before.y1 - after!.y1) > 0.002
        );
      });
      if (changed && !cancelled) setDraft(next);
    };
    void measure();
    return () => { cancelled = true; };
  }, [
    cardPreviewScale,
    done,
    draft.contentFont,
    draft.contentScale,
    draft.author,
    draft.authorEnabled,
    draft.footer,
    draft.footerFont,
    draft.footerScale,
    draft.message,
    draft.title,
    draft.titleFont,
    draft.titleScale,
    getPartTextBox,
    inlineEditingPart,
    previewWsRegion,
    availableTextBox.x0,
    availableTextBox.x1,
    availableTextBox.y0,
    availableTextBox.y1,
    setDraft,
  ]);

  // 폴백: 측정이 끝나지 않아도 done 이후 일정 시간이 지나면 카드를 표시.
  useEffect(() => {
    if (!done || layoutSettled) return;
    const timer = window.setTimeout(() => setLayoutSettled(true), 600);
    return () => window.clearTimeout(timer);
  }, [done, layoutSettled]);

  if (!done) {
    const loadingStage =
      progress < 20 ? "배경과 문구 조화를 찾는 중"
      : progress < 45 ? "감성 레이아웃 계산 중"
      : progress < 70 ? "캘리그래피 위치 배치 중"
      : progress < 90 ? "마지막 감성 터치 추가 중"
      : "거의 완성됐어요";

    return (
      <PhoneShell backHref="/">
        <div className="flex min-h-[640px] flex-col items-center justify-center px-8 text-center">
          {/* 미니멀 스피너 */}
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-stone-200/70" />
            <div
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#7b310d]"
              style={{ animationDuration: "0.9s" }}
            />
          </div>
          <h1 className="mt-7 text-lg font-bold tracking-tight text-[#5a240d]">카드를 만들고 있어요</h1>
          <p className="mt-1.5 h-5 text-sm font-medium text-stone-400 transition-opacity duration-300">
            {loadingStage}
          </p>
          {/* 슬림 프로그레스 */}
          <div className="mt-8 w-full max-w-[260px]">
            <div className="h-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[#7b310d] transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="mt-2 text-right text-[11px] font-semibold tabular-nums text-stone-400">
              {Math.floor(progress)}%
            </div>
          </div>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell backHref="/">
      <LoadingOverlay
        open={finalizing}
        title="저장 중입니다"
        description="카드를 완성해 보관함에 저장하고 있어요."
      />
      {cardImageUrl ? (
        <div
          ref={cardPreviewRef}
          className={`relative overflow-hidden rounded-2xl shadow-lg transition-opacity duration-200 ${layoutSettled ? "opacity-100" : "opacity-0"} ${!useAi ? "cursor-move touch-none ring-2 ring-[#7b310d]/40" : ""}`}
          tabIndex={useAi ? undefined : 0}
          role={useAi ? undefined : "button"}
          aria-label={useAi ? undefined : "카드 미리보기. 텍스트 박스를 더블클릭하거나 Enter를 누르면 문구를 수정할 수 있습니다."}
          onPointerDown={handleTextAreaPointerDown}
          onPointerMove={handleTextAreaPointerMove}
          onPointerUp={handleTextAreaPointerUp}
          onPointerCancel={() => { areaDragStartRef.current = null; }}
          onDoubleClick={handlePreviewDoubleClick}
          onKeyDown={handlePreviewKeyDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImageUrl} alt="마음카드 배경" className="w-full select-none" draggable={false} />
          {filterApplying && (
            <div className="absolute inset-0 z-[5] grid place-items-center bg-white/50 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 px-5 py-4 shadow-lg">
                <div className="relative h-11 w-11">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#7b310d] border-r-[#d98238]" style={{ animationDuration: "0.8s" }} />
                  <div className="absolute inset-0 grid animate-pulse place-items-center text-lg">✨</div>
                </div>
                <span className="text-xs font-black text-[#7b310d]">적용중입니다…</span>
              </div>
            </div>
          )}
          {previewTextBoxes.map(({ part, box, rotation, label }) => {
            const active = showTextBoxes && part === selectedTextBoxPart;
            const typography = getRecommendedTypography(draft);
            const inlineText = inlineEditingPart === part
              ? inlineEditingInitialText
              : part === "title" ? draft.title ?? "" : part === "content" ? draft.message ?? "" : draft.footer ?? "";
            const inlineFontId = part === "title"
              ? draft.titleFont ?? typography.titleFont
              : part === "footer"
                ? draft.footerFont ?? draft.contentFont ?? typography.contentFont
                : draft.contentFont ?? typography.contentFont;
            const inlineFontFamily = CARD_FONTS.find((font) => font.id === inlineFontId)?.family;
            const inlineColor = part === "title"
              ? draft.titleColor && draft.titleColor !== "auto" ? draft.titleColor : "#6f2f18"
              : part === "footer"
                ? draft.footerColor && draft.footerColor !== "auto"
                  ? draft.footerColor
                  : draft.contentColor && draft.contentColor !== "auto" ? draft.contentColor : "#4a2412"
                : draft.contentColor && draft.contentColor !== "auto" ? draft.contentColor : "#4a2412";
            const serverFontSize = getInlineFontSize(part, availableTextBox, draft);
            const inlineFontSize = serverFontSize * cardPreviewScale;
            const inlineTextShadow = "0 1px 3px rgba(255,255,255,.7), 0 1px 3px rgba(0,0,0,.35)";
            const textStyle = {
              color: inlineColor,
              fontFamily: inlineFontFamily,
              fontSize: `${inlineFontSize}px`,
              fontWeight: (part === "title" ? draft.titleBold : part === "footer" ? draft.footerBold : draft.contentBold) ? 700 : 400,
              boxSizing: "border-box" as const,
              width: "100%",
              height: "100%",
              alignContent: "center",
              lineHeight: part === "content" ? 1.36 : part === "footer" ? 1.4 : 1.18,
              textAlign: (part === "content" ? (draft.contentAlign ?? "center") : "center") as "left" | "center" | "right",
              wordBreak: "keep-all" as const,
              overflowWrap: "normal" as const,
              padding: `${4 * cardPreviewScale}px ${8 * cardPreviewScale}px`,
              textShadow: inlineTextShadow,
            };
            const colorClass =
              part === "title"
                ? active ? "border-[#7b310d] bg-[#7b310d]/15 ring-2 ring-white/90" : "border-[#d98238] bg-[#d98238]/10"
                : part === "content"
                  ? active ? "border-[#1f6f78] bg-[#1f6f78]/15 ring-2 ring-white/90" : "border-[#1f6f78] bg-[#1f6f78]/10"
                  : active ? "border-[#6f3cc3] bg-[#6f3cc3]/15 ring-2 ring-white/90" : "border-[#6f3cc3] bg-[#6f3cc3]/10";
            const labelClass =
              part === "title"
                ? active ? "bg-[#7b310d] text-white" : "bg-[#d98238] text-white"
                : part === "content"
                  ? active ? "bg-[#1f6f78] text-white" : "bg-[#1f6f78] text-white"
                  : active ? "bg-[#6f3cc3] text-white" : "bg-[#6f3cc3] text-white";
            return (
              <div
                key={part}
                className={`absolute ${active ? `border-2 shadow-sm ${colorClass}` : ""}`}
                style={{
                  left: `${box.x0 * 100}%`,
                  top: `${box.y0 * 100}%`,
                  width: `${(box.x1 - box.x0) * 100}%`,
                  height: `${(box.y1 - box.y0) * 100}%`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center",
                  zIndex: active ? 3 : 2,
                }}
              >
                {active && (
                  <span className={`pointer-events-none absolute -left-0.5 -top-6 rounded px-2 py-0.5 text-[11px] font-black shadow-sm ${labelClass}`}>
                    {label}
                  </span>
                )}

                {active && (part === "title" || part === "footer") && (
                  <button
                    type="button"
                    aria-label={part === "title" ? "받는 사람 삭제" : "보내는 사람 삭제"}
                    title="삭제"
                    className="pointer-events-auto absolute -right-3 -top-3 z-20 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-red-500 text-white shadow-md transition hover:bg-red-600 active:scale-95"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteTextPart(part);
                    }}
                  >
                    <X size={15} strokeWidth={3} />
                  </button>
                )}
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                >
                  {inlineEditingPart === part ? (
                  <div
                      ref={(element) => {
                        inlineEditorRef.current = element;
                        if (element) previewTextRefs.current[part] = element;
                        else delete previewTextRefs.current[part];
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label={part === "title" ? "받는 사람 바로 수정" : part === "content" ? "내용 문구 바로 수정" : "보내는 사람 바로 수정"}
                      onInput={(event) => {
                        const maxLength = part === "title" ? 20 : part === "footer" ? 40 : 500;
                        const value = readEditableText(event.currentTarget).slice(0, maxLength);
                        inlineEditingValueRef.current = value;
                        pendingInlineEditsRef.current[part] = value;
                        const update: Partial<Draft> = part === "title"
                          ? { title: value }
                          : part === "footer"
                            ? { footer: value }
                            : { message: value, messageOrigin: "direct" };
                        const nextDraft = { ...draftRef.current, ...update };
                        draftRef.current = nextDraft;
                        writeJson(draftStorageKey, nextDraft);
                      }}
                      onBlur={endInlineEditing}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
                          event.preventDefault();
                          insertLineBreakAtCursor();
                          inlineEditingValueRef.current = readEditableText(event.currentTarget);
                          return;
                        }
                        if (
                          event.key === "Escape"
                          || (event.key === "Enter" && (event.ctrlKey || event.metaKey))
                        ) {
                          event.preventDefault();
                          endInlineEditing();
                        }
                      }}
                      className="pointer-events-auto overflow-y-auto whitespace-pre-wrap bg-white/10 text-center outline-none caret-current"
                      style={textStyle}
                    >
                      {inlineText}
                    </div>
                  ) : (
                    <div
                      ref={(element) => {
                        if (element) previewTextRefs.current[part] = element;
                        else delete previewTextRefs.current[part];
                      }}
                      className="flex items-center justify-center whitespace-pre-wrap text-center"
                      style={textStyle}
                    >
                      {inlineText}
                    </div>
                  )}
                </div>
                {active && (
                  <>
                    <span className="pointer-events-none absolute -top-3 left-1/2 h-6 w-10 -translate-x-1/2 rounded-full border-[3px] border-white bg-[#1f6f78] shadow-lg" />
                    <span className="pointer-events-none absolute -bottom-3 left-1/2 h-6 w-10 -translate-x-1/2 rounded-full border-[3px] border-white bg-[#1f6f78] shadow-lg" />
                    {part === "content" && (
                      <>
                        <span className="pointer-events-none absolute -left-3 top-1/2 h-10 w-6 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#1f6f78] shadow-lg" />
                        <span className="pointer-events-none absolute -right-3 top-1/2 h-10 w-6 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#1f6f78] shadow-lg" />
                      </>
                    )}
                    {/* 회전마크 — 박스 우측 하단(se). 잡고 돌려서 회전. */}
                    <span className="absolute -bottom-6 -right-6 grid h-12 w-12 place-items-center rounded-full border-[3px] border-white bg-[#1f6f78] text-white shadow-lg">
                      <RotateCcw size={18} />
                    </span>
                  </>
                )}
              </div>
            );
          })}
          
          {/* Quick Typography Tool (Rendered as a sibling to prevent text box boundary and rotation conflicts) */}
          {showTextBoxes && selectedTextBoxPart && !useAi && (() => {
            const activeTextBox = previewTextBoxes.find((tb) => tb.part === selectedTextBoxPart);
            if (!activeTextBox) return null;
            const { part, box, label } = activeTextBox;
            
            const typography = getRecommendedTypography(draft);
            const inlineFontId = part === "title"
              ? draft.titleFont ?? typography.titleFont
              : part === "footer"
                ? draft.footerFont ?? draft.contentFont ?? typography.contentFont
                : draft.contentFont ?? typography.contentFont;
            const inlineFontFamily = CARD_FONTS.find((font) => font.id === inlineFontId)?.family;
            const colorKey = part === "title" ? "titleColor" : part === "footer" ? "footerColor" : "contentColor";
            const inlineColor = part === "title"
              ? draft.titleColor && draft.titleColor !== "auto" ? draft.titleColor : "#6f2f18"
              : part === "footer"
                ? draft.footerColor && draft.footerColor !== "auto"
                  ? draft.footerColor
                  : draft.contentColor && draft.contentColor !== "auto" ? draft.contentColor : "#4a2412"
                : draft.contentColor && draft.contentColor !== "auto" ? draft.contentColor : "#4a2412";

            const previewWidthPx = Math.max(320, CARD_PREVIEW_WIDTH * cardPreviewScale);
            const previewHeightPx = Math.max(480, CARD_PREVIEW_HEIGHT * cardPreviewScale);
            const quickToolWidthPx = Math.min(312, previewWidthPx - 16);
            const quickToolHeightPx = 52;
            const quickToolWidthRatio = quickToolWidthPx / previewWidthPx;
            const quickToolHeightRatio = quickToolHeightPx / previewHeightPx;
            const quickToolGapX = 8 / previewWidthPx;
            const quickToolGapY = 8 / previewHeightPx;
            
            const rightSpace = 1 - box.x1;
            const leftSpace = box.x0;
            const quickToolX = rightSpace >= quickToolWidthRatio + quickToolGapX
              ? box.x1 + quickToolGapX
              : leftSpace >= quickToolWidthRatio + quickToolGapX
                ? box.x0 - quickToolWidthRatio - quickToolGapX
                : clampRange(box.x0, quickToolGapX, 1 - quickToolWidthRatio - quickToolGapX);

            const fitsAbove = box.y0 >= quickToolHeightRatio + quickToolGapY;
            const fitsBelow = (1 - box.y1) >= quickToolHeightRatio + quickToolGapY;
            const quickToolY = fitsAbove 
              ? box.y0 - quickToolHeightRatio - quickToolGapY 
              : fitsBelow 
                ? box.y1 + quickToolGapY 
                : (box.y0 > 0.5 
                    ? quickToolGapY 
                    : 1 - quickToolHeightRatio - quickToolGapY);

            const isBoldVal = part === "title" ? draft.titleBold : part === "footer" ? draft.footerBold : draft.contentBold;

            return (
              <div
                className="pointer-events-auto absolute z-30 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md"
                style={{
                  left: `${quickToolX * 100}%`,
                  top: `${quickToolY * 100}%`,
                  width: `${quickToolWidthPx}px`,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <label
                  className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-white/40 shadow-sm transition hover:scale-105"
                  title={`${label} 글자색`}
                  style={{
                    background: "conic-gradient(from 45deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)",
                  }}
                >
                  <input
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label={`${label} 직접 색상 선택`}
                    type="color"
                    value={inlineColor}
                    onChange={(event) => {
                      setDraftWithUndo({ [colorKey]: event.target.value });
                    }}
                  />
                  <span
                    className="pointer-events-none h-4.5 w-4.5 rounded-full border-[2.5px] border-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                    style={{ backgroundColor: inlineColor }}
                  />
                </label>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDraftWithUndo({
                      [part === "title" ? "titleBold" : part === "footer" ? "footerBold" : "contentBold"]: !isBoldVal
                    });
                  }}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition hover:scale-105 active:scale-95 ${
                    isBoldVal
                      ? "border-[#7b310d] bg-[#7b310d]/10 text-[#7b310d]"
                      : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                  title="글자 두껍게"
                  aria-label="글자 두껍게 설정"
                >
                  <span className="text-sm font-black">B</span>
                </button>
                <label className="relative flex h-9 min-w-0 flex-1 items-center rounded-full border border-stone-200 bg-white pl-2.5 shadow-sm">
                  <Type size={15} className="pointer-events-none shrink-0 text-[#7b310d]" />
                  <select
                    aria-label={`${label} 글씨체 선택`}
                    value={inlineFontId}
                    onChange={(event) => {
                      // 제목·내용·보내는사람 모두 같은 글씨체로 통일
                      const f = event.target.value;
                      setDraftWithUndo({ titleFont: f, contentFont: f, footerFont: f });
                    }}
                    className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent px-1.5 pr-6 text-xs font-bold text-stone-800 outline-none"
                    style={{ fontFamily: inlineFontFamily }}
                  >
                    {enabledFonts.map((font) => (
                      <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} strokeWidth={2.5} className="pointer-events-none absolute right-1.5 text-[#7b310d]" />
                </label>
                <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-stone-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      adjustPartFontScale(part, -0.05);
                    }}
                    className="grid h-full w-7 place-items-center text-sm font-black text-[#5a240d] transition hover:bg-orange-50 active:bg-orange-100"
                    aria-label={`${label} 글씨 작게`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      adjustPartFontScale(part, 0.05);
                    }}
                    className="grid h-full w-7 place-items-center border-l border-stone-200 text-sm font-black text-[#5a240d] transition hover:bg-orange-50 active:bg-orange-100"
                    aria-label={`${label} 글씨 크게`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })()}

          {!useAi && (
            <div className="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-white/85 px-3 py-2 text-center text-[11px] font-bold text-[#7b310d] shadow-sm backdrop-blur">
              BODY 좌우 손잡이로 가로 길이 조절 · 박스 드래그로 이동 · −/+로 글자 크기 조절
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="font-bold text-red-700">{generationError ?? "AI 감성 합성 이미지가 아직 생성되지 않았습니다."}</p>
        </div>
      )}
      {/* 미리보기 조정 (로컬 렌더 전용) */}
      {!useAi && cardImageUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
          {/* 폰트 미리보기용 @font-face (각 글씨체를 실제 모양으로 표시) */}
          <style>{CARD_FONTS.map((f) => `@font-face{font-family:'${f.family}';src:url('/fonts/${f.file}') format('truetype');font-display:swap;}`).join("")}</style>

          {/* 사진 필터 (배경 효과) — 항상 노출, 선택 시 미리보기 즉시 적용 */}
          <div className="border-b border-stone-100 px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-black text-stone-800">사진 필터 <span className="text-xs font-semibold text-stone-400">(배경 효과)</span></span>
              {filterApplying && (
                <span className="flex items-center gap-1 text-[11px] font-black text-[#7b310d]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#7b310d]/30 border-t-[#7b310d]" />
                  적용중입니다…
                </span>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {BG_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDraftWithUndo({ bgFilter: id })}
                  className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs font-bold transition active:scale-95 ${(draft.bgFilter ?? "none") === id ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200 bg-white text-stone-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDetailPanelOpen((open) => !open)}
            className="flex h-14 w-full items-center justify-between bg-white px-4 text-left transition hover:bg-stone-50 active:bg-stone-100"
            aria-expanded={isDetailPanelOpen}
            aria-controls="card-detail-editor"
          >
            <span>
              <span className="block text-sm font-black text-stone-800">상세 글씨 편집</span>
              <span className="mt-0.5 block text-xs font-semibold text-stone-400">
                폰트 · 색상 · 크기 · 배치
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-[#7b310d]/10 px-2.5 py-1 text-[11px] font-black text-[#7b310d]">
                {isDetailPanelOpen ? "접기" : "펼치기"}
              </span>
              <ChevronDown
                size={22}
                strokeWidth={3}
                className={`text-[#7b310d] transition-transform duration-300 ${isDetailPanelOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          <div
            id="card-detail-editor"
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isDetailPanelOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden border-t border-stone-100">
          {/* 책갈피 탭 (최상단) — 제목/내용 각각 독립 편집 */}
          <div className="sticky top-0 z-20 grid grid-cols-3 gap-1.5 border-b border-stone-100 bg-white/95 px-3 py-2.5 backdrop-blur">
            {([["title", "받는 사람"], ["content", "내용"]] as const).map(([id, label]) => {
              const active = adjTab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setAdjTab(id);
                    setShowTextBoxes(true);
                    setSelectedTextBoxPart(id);
                  }}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-black transition ${active ? "bg-[#7b310d] text-white shadow-sm" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setAdjTab("footer");
                setShowTextBoxes(true);
                setSelectedTextBoxPart("footer");
              }}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-black transition ${adjTab === "footer" ? "bg-[#7b310d] text-white shadow-sm" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
            >
              보내는 사람
            </button>
          </div>

          <div className="border-b border-stone-100 bg-white px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <span className="text-xs font-black text-stone-600">
                선택: {adjTab === "title" ? "TITLE" : adjTab === "content" ? "BODY" : "FOOTER"}
              </span>
              <span className="text-[11px] font-bold text-stone-400">
                이동 · 크기 · 회전 조정
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => {
                  setShowTextBoxes(true);
                  manuallyPositionedPartsRef.current.clear();
                  setDraftWithUndo({
                    ...getRecommendedTypography(draft),
                    ...getDefaultPartTextBoxes(draft.cardPosition, draft),
                    titleRotation: undefined,
                    contentRotation: undefined,
                    footerRotation: undefined,
                  });
                }}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#7b310d]/20 bg-orange-50 text-sm font-black text-[#7b310d] transition hover:bg-orange-100 active:scale-[0.98]"
              >
                <Sparkles size={16} />
                추천 적용
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!hasCustomActiveTextBox}
                onClick={resetActiveTextBox}
                className="h-9 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
              >
                영역 초기화
              </button>
              <button
                type="button"
                disabled={activeRotation === 0}
                onClick={() => {
                  pushUndoSnapshot();
                  setShowTextBoxes(true);
                  setSelectedTextBoxPart(adjTab);
                  setPartRotation(adjTab, 0);
                }}
                className="h-9 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
              >
                회전 초기화
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTextBoxes(false);
                  setSelectedTextBoxPart(null);
                }}
                className="h-9 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-500 transition hover:bg-stone-50"
              >
                박스 숨김
              </button>
            </div>
          </div>

          {(() => {
            const editPart = showTextBoxes && selectedTextBoxPart ? selectedTextBoxPart : "content";
            const isTitle = editPart === "title";
            const isFooter = editPart === "footer";
            const colorKey = isTitle ? "titleColor" : isFooter ? "footerColor" : "contentColor";
            const scaleKey = isTitle ? "titleScale" : isFooter ? "footerScale" : "contentScale";
            const typography = getRecommendedTypography(draft);
            const fontVal = (
              isTitle ? draft.titleFont
                : isFooter ? draft.footerFont ?? draft.contentFont
                  : draft.contentFont
            ) ?? (isTitle ? typography.titleFont : typography.contentFont);
            const colorVal = (
              isTitle ? draft.titleColor
                : isFooter ? draft.footerColor
                  : draft.contentColor
            ) ?? "auto";
            const scaleVal = (draft[scaleKey] as number | undefined) ?? (isTitle ? typography.titleScale : isFooter ? 1 : typography.contentScale);
            const sampleText = isTitle
              ? (draft.title?.trim() || "받는 사람")
              : isFooter
                ? (draft.footer?.trim()?.slice(0, 10) || "보내는 사람")
                : (draft.message?.trim()?.slice(0, 10) || "내용 미리보기");
            return (
              <div className="space-y-4 p-4">
                {/* 문구 수정 */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">
                      {isTitle ? "받는 사람" : isFooter ? "보내는 사람" : "내용 문구"}
                    </label>
                    {(isTitle || isFooter) && (
                      <button
                        type="button"
                        onClick={() => deleteTextPart(isTitle ? "title" : "footer")}
                        disabled={isTitle ? !draft.title?.trim() : !draft.footer?.trim() && !draft.author?.trim()}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`${isTitle ? "받는 사람" : "보내는 사람"} 삭제`}
                      >
                        <Trash2 size={13} />
                        삭제
                      </button>
                    )}
                  </div>
                  {isTitle ? (
                    <input
                      type="text"
                      value={draft.title ?? ""}
                      onChange={(e) => {
                        const nextTitle = e.target.value;
                        const typography = getRecommendedTypography({ ...draft, title: nextTitle });
                        setDraftWithUndo({
                          title: nextTitle,
                          titleFont: typography.titleFont,
                          titleScale: typography.titleScale,
                        });
                      }}
                      placeholder="제목 (비우면 내용만 표시)"
                      maxLength={20}
                      className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
                    />
                  ) : isFooter ? (
                    <input
                      type="text"
                      value={draft.footer ?? ""}
                      onChange={(e) => {
                        const nextFooter = e.target.value;
                        setDraftWithUndo({
                          footer: nextFooter,
                        });
                      }}
                      placeholder="예: 사랑하는 딸 지은이가"
                      maxLength={40}
                      className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3.5 text-sm outline-none transition focus:border-[#7b310d] focus:ring-2 focus:ring-[#7b310d]/10"
                    />
                  ) : (
                    <textarea
                      value={draft.message ?? ""}
                      onChange={(e) => {
                        const nextMessage = e.target.value;
                        const typography = getRecommendedTypography({ ...draft, message: nextMessage });
                        setDraftWithUndo({
                          message: nextMessage,
                          messageOrigin: "direct",
                          contentRotation: undefined,
                          titleFont: typography.titleFont,
                          contentFont: typography.contentFont,
                          titleScale: typography.titleScale,
                          contentScale: typography.contentScale,
                        });
                      }}
                      placeholder="내용을 입력하세요"
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm leading-6 outline-none focus:border-[#7b310d]"
                    />
                  )}
                </div>

                {/* 글씨체 — 각 폰트를 실제 글씨체로 보여주는 세로 리스트 */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">글씨체 <span className="font-normal text-stone-400">({enabledFonts.length}종)</span></label>
                  </div>
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/50">
                    {(["손글씨", "명조", "고딕", "디자인"] as const).map((group) => (
                      <div key={group}>
                        <div className="sticky top-0 z-10 bg-stone-50 px-3 py-1 text-[10px] font-bold tracking-wide text-stone-400">{group}</div>
                        {enabledFonts.filter((f) => f.group === group).map((f) => {
                          const active = fontVal === f.id;
                          return (
                            <button
                              key={f.id}
                              onClick={() => {
                                setShowTextBoxes(true);
                                setSelectedTextBoxPart(editPart);
                                // 제목·내용·보내는사람 모두 같은 글씨체로 통일
                                setDraftWithUndo({ titleFont: f.id, contentFont: f.id, footerFont: f.id });
                              }}
                              className={`flex w-full items-center justify-between gap-3 border-b border-stone-50 px-3 py-2 text-left transition ${active ? "bg-orange-50" : "hover:bg-stone-50"}`}
                            >
                              <span className="min-w-0 flex-1 truncate text-2xl leading-tight text-stone-800" style={{ fontFamily: f.family }}>
                                {sampleText}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className={`text-[11px] font-semibold ${active ? "text-[#7b310d]" : "text-stone-400"}`}>{f.label}</span>
                                {active && <Check size={15} className="text-[#7b310d]" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 색 */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">글자색</label>
                    <span className="font-mono text-[10px] font-bold uppercase text-stone-400">
                      {colorVal === "auto" ? "배경 자동 맞춤" : colorVal}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setShowTextBoxes(true);
                        setSelectedTextBoxPart(editPart);
                        setDraftWithUndo({ [colorKey]: "auto" });
                      }}
                      className={`h-9 rounded-lg border px-3 text-xs font-bold transition ${colorVal === "auto" ? "border-[#7b310d] bg-[#7b310d] text-white" : "border-stone-200 bg-white text-stone-600"}`}
                    >
                      자동
                    </button>
                    {(["#3b1f10", "#000000", "#fdf6ec", "#7b310d", "#d6336c", "#c2410c", "#1e3a5f", "#2f6b4f", "#6f3cc3"]).map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setShowTextBoxes(true);
                          setSelectedTextBoxPart(editPart);
                          setDraftWithUndo({ [colorKey]: c });
                        }}
                        aria-label={c}
                        className={`h-9 w-9 rounded-full border-2 transition hover:scale-110 ${colorVal === c ? "border-[#7b310d] ring-2 ring-[#7b310d]/30" : "border-white shadow"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label
                      className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-white shadow transition hover:scale-110"
                      title="직접 색상 선택"
                      style={{
                        background: "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
                      }}
                    >
                      <input
                        type="color"
                        value={colorVal === "auto" ? "#4a2412" : colorVal}
                        onChange={(event) => {
                          setShowTextBoxes(true);
                          setSelectedTextBoxPart(editPart);
                          setDraftWithUndo({ [colorKey]: event.target.value });
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="직접 색상 선택"
                      />
                      <span className="h-3 w-3 rounded-full border border-white bg-white shadow" />
                    </label>
                  </div>
                </div>

                {/* 크기 슬라이더 */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">글씨 크기</label>
                    <span className="text-xs font-bold text-[#7b310d]">{Math.round(scaleVal * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={180}
                    step={5}
                    value={Math.round(scaleVal * 100)}
                    onChange={(e) => {
                      const nextScale = Number(e.target.value) / 100;
                      setShowTextBoxes(true);
                      setSelectedTextBoxPart(editPart);
                      setDraftWithUndo({
                        [scaleKey]: nextScale,
                      });
                    }}
                    className="mt-2 h-2 w-full accent-[#7b310d]"
                  />
                </div>

                {/* 글씨 두께 */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                  <label className="text-xs font-bold text-stone-500">글씨 두께</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([
                      { id: false, label: "보통" },
                      { id: true, label: "굵게" },
                    ] as const).map((weightOpt) => {
                      const isBold = editPart === "title" ? draft.titleBold : editPart === "footer" ? draft.footerBold : draft.contentBold;
                      const active = Boolean(isBold) === weightOpt.id;
                      return (
                        <button
                          type="button"
                          key={weightOpt.label}
                          onClick={() => {
                            setShowTextBoxes(true);
                            setSelectedTextBoxPart(editPart);
                            setDraftWithUndo({
                              [editPart === "title" ? "titleBold" : editPart === "footer" ? "footerBold" : "contentBold"]: weightOpt.id
                            });
                          }}
                          className={`h-9 rounded-lg border text-xs font-bold transition ${
                            active
                              ? "border-[#7b310d] bg-orange-50 text-[#7b310d]"
                              : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                          }`}
                        >
                          {weightOpt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 본문 정렬 (BODY 전용) */}
                {editPart === "content" && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
                    <label className="text-xs font-bold text-stone-500">본문 정렬</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([["left", "왼쪽"], ["center", "중앙"], ["right", "오른쪽"]] as const).map(([id, label]) => {
                        const active = (draft.contentAlign ?? "center") === id;
                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => {
                              setShowTextBoxes(true);
                              setSelectedTextBoxPart("content");
                              setDraftWithUndo({ contentAlign: id });
                            }}
                            className={`flex h-9 items-center justify-center gap-1 rounded-lg border text-xs font-bold transition ${
                              active ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                            }`}
                          >
                            {id === "left" ? <AlignLeft size={14} /> : id === "right" ? <AlignRight size={14} /> : <AlignCenter size={14} />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 배치 (공통) */}
                <div>
                  <label className="text-xs font-bold text-stone-500">글씨 배치 <span className="font-normal text-stone-400">(공통)</span></label>
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                    {([["auto", "자동"], ["top", "위"], ["center", "가운데"], ["bottom", "아래"]] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setShowTextBoxes(true);
                          manuallyPositionedPartsRef.current.clear();
                          setDraftWithUndo({
                            cardPosition: id,
                            textBox: undefined,
                            ...getDefaultPartTextBoxes(id, draft),
                            titleRotation: undefined,
                            contentRotation: undefined,
                            footerRotation: undefined,
                          });
                        }}
                        className={`h-9 rounded-lg border text-xs font-bold transition ${(draft.cardPosition ?? "auto") === id ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200 bg-white text-stone-500"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            );
          })()}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => void finalizeCard("/library")}
          disabled={finalizing}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-black text-white disabled:opacity-50"
        >
          <Check size={19} /> {finalizing ? "완성 이미지 저장 중..." : "완성후 보관함저장"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft({
              titleRotation: undefined,
              contentRotation: undefined,
              footerRotation: undefined,
              titleTextBox: undefined,
              contentTextBox: undefined,
              footerTextBox: undefined,
              textBox: undefined,
            });
            router.push("/create/background");
          }}
          disabled={finalizing}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white text-sm font-bold text-stone-500 disabled:opacity-50"
        >
          <RotateCcw size={17} /> 다시 만들기
        </button>
      </div>

      {/* 디버그 패널 */}
      {debugPrompt && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="flex w-full items-center justify-between font-bold text-violet-700"
          >
            <span>🔍 AI 프롬프트 보기</span>
            <span>{showDebug ? "▲" : "▼"}</span>
          </button>
          {showDebug && (
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-violet-900">
              {debugPrompt}
            </pre>
          )}
        </div>
      )}
    </PhoneShell>
  );
}

export function LibraryScreen() {
  const { cards, loading, toggleFav, deleteCard, deleteAll } = useSupabaseCards();
  const { isSaved: isMessageSaved, toggle: toggleSavedMessage } = useFavMessages();
  const uiSettings = usePublicUiSettings();
  const [tab, setTab] = useState("전체");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [expandedCard, setExpandedCard] = useState<CardItem | null>(null);
  const [msgExpanded, setMsgExpanded] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [gifBusy, setGifBusy] = useState(false);
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const [gifEffect, setGifEffect] = useState<GifEffectId>("sparkle");
  const [gifSaved, setGifSaved] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const gifPreviewUrlRef = useRef<string | null>(null);

  const replaceGifPreview = useCallback((blob: Blob | null) => {
    if (gifPreviewUrlRef.current) {
      URL.revokeObjectURL(gifPreviewUrlRef.current);
    }
    const nextUrl = blob ? URL.createObjectURL(blob) : null;
    gifPreviewUrlRef.current = nextUrl;
    setGifBlob(blob);
    setGifPreviewUrl(nextUrl);
  }, []);

  useEffect(() => {
    replaceGifPreview(null);
    setShareUrl(null);
  }, [expandedCard?.id, replaceGifPreview]);

  const selectGifEffect = (effect: GifEffectId) => {
    setGifEffect(effect);
    setGifSaved(false);
    setShareUrl(null);
    replaceGifPreview(null);
  };

  useEffect(() => () => {
    if (gifPreviewUrlRef.current) {
      URL.revokeObjectURL(gifPreviewUrlRef.current);
    }
  }, []);

  const handlePreviewGif = async () => {
    const imgUrl = expandedCard?.cardImageUrl;
    if (!imgUrl || gifBusy) return;
    setGifBusy(true);
    setGifSaved(false);
    try {
      const blob = await generateRetroGif(imgUrl, gifEffect);
      replaceGifPreview(blob);
    } catch {
      window.alert("GIF 미리보기를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setGifBusy(false);
    }
  };

  const handleSaveGif = async () => {
    const imgUrl = expandedCard?.cardImageUrl;
    if (!imgUrl || gifBusy) return;
    setGifBusy(true);
    setGifSaved(false);
    try {
      const blob = gifBlob ?? await generateRetroGif(imgUrl, gifEffect);
      if (!gifBlob) replaceGifPreview(blob);
      const fileName = `마음카드_${gifEffect}_${expandedCard?.name ?? "card"}_${Date.now()}.gif`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setGifSaved(true);
    } catch {
      window.alert("GIF 만들기에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setGifBusy(false);
    }
  };

  // GIF 를 스토리지에 올리고 카드별 공유 페이지(/share/[cardId]) 링크를 만들어 바로가기·공유.
  const handleShareGif = async () => {
    const card = expandedCard;
    const imgUrl = card?.cardImageUrl;
    if (!card || !imgUrl || gifBusy || shareBusy) return;
    if (card.id.startsWith("local-") || card.id.startsWith("sample-")) {
      window.alert("이 카드는 먼저 보관함에 저장해야 공유할 수 있어요.");
      return;
    }
    setShareBusy(true);
    try {
      const blob = gifBlob ?? await generateRetroGif(imgUrl, gifEffect);
      if (!gifBlob) replaceGifPreview(blob);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.alert("로그인 후 공유할 수 있어요.");
        return;
      }

      // 작성자ID 폴더 아래에 GIF 저장 → 공개 URL 을 카드에 기록.
      const fileName = `${user.id}/gifs/${card.id}_${Date.now()}.gif`;
      const { error: uploadError } = await supabase.storage
        .from("card-images")
        .upload(fileName, blob, { contentType: "image/gif", upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(fileName);
      await updateCardGifUrl(card.id, publicUrl);

      // 방금 올린 GIF 를 CDN 에 미리 한 번 요청해 공유 페이지 첫 로드 시 전파 지연(빈 화면) 완화.
      try { await fetch(publicUrl, { cache: "reload" }); } catch { /* ignore */ }

      const url = `${window.location.origin}/share/${card.id}`;
      setShareUrl(url);

      // 바로가기 + 공유 시도 (실패해도 아래 링크 버튼으로 다시 열 수 있음).
      try { window.open(url, "_blank", "noopener"); } catch { /* popup blocked */ }
      if (navigator.share) {
        try { await navigator.share({ title: card.name, url }); } catch { /* cancelled */ }
      } else if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      }
    } catch (error) {
      const msg = error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      window.alert(`카드 공유에 실패했어요.\n(사유: ${msg})`);
    } finally {
      setShareBusy(false);
    }
  };

  const displayed = cards.filter((card) => tab !== "즐겨찾기" || card.favorite);

  const handleDelete = (cardId: string) => {
    deleteCard(cardId);
    setConfirmId(null);
  };

  const handleDeleteAll = async () => {
    await deleteAll();
    setConfirmAll(false);
  };

  return (
    <PhoneShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">내가 만든 카드</h1>
        <div className="flex items-center gap-3">
          {cards.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setConfirmAll(true);
                setConfirmId(null);
              }}
              className="text-sm font-bold text-red-500"
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>
      {confirmAll && cards.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <span className="flex-1 text-xs font-bold text-red-700">카드 {cards.length}개를 모두 삭제할까요?</span>
          <button onClick={handleDeleteAll} className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white">삭제</button>
          <button onClick={() => setConfirmAll(false)} className="rounded-md bg-stone-200 px-3 py-1 text-xs font-bold text-stone-600">취소</button>
        </div>
      )}
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-md bg-stone-100 p-1">
        {["전체", "즐겨찾기", "공유한 카드"].map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`h-9 rounded-md text-sm font-bold ${tab === item ? "bg-[#7b310d] text-white" : "text-stone-600"}`}>{item}</button>
        ))}
      </div>
      {!loading && displayed.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-stone-200 py-12 text-center">
          <p className="font-bold text-stone-500">카드가 없어요.</p>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {displayed.map((card) => (
          <article
            key={card.id}
            className="relative rounded-lg border border-stone-200 bg-white p-2 transition"
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmId(confirmId === card.id ? null : card.id);
              }}
              className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-600"
              aria-label={`${card.name} 카드 삭제`}
            >
              <Trash2 size={14} />
            </button>
            {confirmId === card.id && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/60 p-3">
                <p className="text-center text-xs font-bold text-white">삭제할까요?</p>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="h-8 w-full rounded-md bg-red-500 text-xs font-bold text-white"
                >
                  삭제
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="h-8 w-full rounded-md bg-white/20 text-xs font-bold text-white"
                >
                  취소
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setExpandedCard(card);
                setMsgExpanded(false);
              }}
              className="block w-full text-left"
              aria-label={`${card.name} 카드 확대`}
            >
              <CardArt card={card} />
            </button>
            <div className="mt-2 flex items-center justify-between px-1">
              <div>
                <div className="font-bold">{card.name}</div>
                <div className="text-xs text-stone-500">{card.createdAt}</div>
              </div>
              <button onClick={() => toggleFav(card.id, !card.favorite)} aria-label="즐겨찾기">
                <Star size={19} className={card.favorite ? "fill-amber-400 text-amber-400" : "text-stone-400"} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {loading && (
        <div className="grid place-items-center py-8 text-sm font-semibold text-stone-400">
          불러오는 중...
        </div>
      )}
      {expandedCard && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(3vh,env(safe-area-inset-top))]"
          onClick={() => setExpandedCard(null)}
        >
          <div
            className="relative max-h-[calc(100dvh-5vh)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setExpandedCard(null)}
              className="absolute right-2 top-2 z-30 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-stone-800 shadow"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
            <div className="relative mx-auto max-h-[62dvh] overflow-hidden rounded-t-2xl bg-stone-950">
              {gifPreviewUrl ? (
                <Image
                  src={gifPreviewUrl}
                  alt={`${expandedCard.name} 레트로 GIF 미리보기`}
                  width={320}
                  height={427}
                  unoptimized
                  className="mx-auto h-auto max-h-[62dvh] w-full object-contain"
                />
              ) : (
                <CardArt card={expandedCard} />
              )}
              {gifBusy && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 text-white">
                  <div className="flex flex-col items-center gap-2 text-sm font-black">
                    <span className="h-8 w-8 animate-spin rounded-full border-4 border-white/35 border-t-white" />
                    GIF 애니메이션 만드는 중...
                  </div>
                </div>
              )}
              {/* 사진 상단 컨트롤: GIF 효과 선택 + 미리보기 */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/60 via-black/30 to-transparent p-2 pr-12">
                <div className="pointer-events-auto relative flex-1">
                  <select
                    value={gifEffect}
                    onChange={(e) => selectGifEffect(e.target.value as GifEffectId)}
                    disabled={gifBusy}
                    aria-label="GIF 효과 선택"
                    className="h-9 w-full appearance-none rounded-lg border border-white/30 bg-black/55 pl-3 pr-8 text-xs font-bold text-white outline-none backdrop-blur disabled:opacity-50"
                  >
                    {GIF_EFFECTS.map((effect) => (
                      <option key={effect.id} value={effect.id} className="text-stone-800">
                        {effect.emoji} {effect.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/80" />
                </div>
                <button
                  onClick={handlePreviewGif}
                  disabled={gifBusy || !expandedCard.cardImageUrl}
                  className="pointer-events-auto flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white/90 px-3 text-xs font-black text-[#7b310d] shadow transition active:scale-95 disabled:opacity-50"
                >
                  <Sparkles size={14} /> {gifPreviewUrl ? "다시" : "미리보기"}
                </button>
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-black">{expandedCard.name}</div>
                <button
                  onClick={() => setMsgExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs font-bold text-[#7b310d]"
                >
                  {msgExpanded ? "접기" : "내용보기"}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${msgExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
              {msgExpanded && (
                <div className="mt-2">
                  <p
                    className="whitespace-pre-wrap text-stone-600"
                    style={
                      expandedCard.purpose === "hand"
                        ? { fontSize: `${uiSettings.hand_viewer_font_size}px`, lineHeight: 1.85 }
                        : { fontSize: "14px", lineHeight: 1.75 }
                    }
                  >
                    {expandedCard.message}
                  </p>
                  <button
                    type="button"
                    disabled={savingMessage}
                    onClick={async () => {
                      setSavingMessage(true);
                      try {
                        await toggleSavedMessage(expandedCard.message, expandedCard.purpose);
                      } finally {
                        setSavingMessage(false);
                      }
                    }}
                    className={`mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                      isMessageSaved(expandedCard.message)
                        ? "bg-[#7b310d] text-white"
                        : "border border-[#7b310d] bg-white text-[#7b310d]"
                    }`}
                  >
                    <Bookmark size={14} className={isMessageSaved(expandedCard.message) ? "fill-current" : ""} />
                    {savingMessage ? "처리 중..." : isMessageSaved(expandedCard.message) ? "내 문구에 저장됨" : "내 문구로 저장"}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-b-2xl bg-white px-4 pb-4">
              <button
                onClick={handleSaveGif}
                disabled={gifBusy || !expandedCard.cardImageUrl}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[#7b310d] px-3 text-sm font-black text-white shadow transition active:scale-[0.99] disabled:opacity-60"
              >
                <Download size={16} />
                {gifBusy
                  ? "선택한 효과로 GIF 만드는 중..."
                  : gifSaved
                    ? "다운로드 완료 · 다시 저장"
                    : `${GIF_EFFECTS.find((effect) => effect.id === gifEffect)?.label} GIF 바로 저장`}
              </button>
              {/* GIF 생성 후 활성화 — 움직이는 GIF + 랜덤 음악 공유 페이지 만들기 */}
              <button
                onClick={handleShareGif}
                disabled={!gifBlob || gifBusy || shareBusy}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white shadow transition active:scale-[0.99] disabled:opacity-50"
              >
                <Share2 size={16} />
                {shareBusy
                  ? "공유 페이지 만드는 중..."
                  : !gifBlob
                    ? "먼저 GIF 미리보기를 만들어주세요"
                    : shareUrl
                      ? "공유 링크 다시 만들기"
                      : "움직이는 카드 공유하기"}
              </button>
              {shareUrl && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="flex-1 truncate text-xs font-bold text-emerald-800">{shareUrl}</span>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
                  >
                    열기
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard?.writeText(shareUrl);
                        window.alert("공유 링크가 복사되었습니다.");
                      } catch {
                        window.open(shareUrl, "_blank");
                      }
                    }}
                    className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow"
                  >
                    복사
                  </button>
                </div>
              )}
              <div className="flex gap-2">
              <button
                onClick={async () => {
                  const imgUrl = expandedCard.cardImageUrl;
                  if (!imgUrl) {
                    window.alert("이 카드는 아직 이미지가 없어 링크를 보낼 수 없어요.");
                    return;
                  }
                  // 이미지 링크 공유 — 받는 사람이 링크를 열면 이미지가 바로 보인다.
                  if (navigator.share) {
                    try { await navigator.share({ title: expandedCard.name, url: imgUrl }); } catch { /* cancelled */ }
                  } else if (navigator.clipboard?.writeText) {
                    try {
                      await navigator.clipboard.writeText(imgUrl);
                      window.alert("이미지 링크가 복사되었습니다. 붙여넣어 보내면 바로 볼 수 있어요.");
                    } catch {
                      window.open(imgUrl, "_blank");
                    }
                  } else {
                    window.open(imgUrl, "_blank");
                  }
                }}
                className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-bold text-stone-700 shadow"
              >
                <Share2 size={15} /> 링크 보내기
              </button>
              <button
                onClick={async () => {
                  const imgUrl = expandedCard.cardImageUrl;
                  if (!imgUrl) return;
                  try {
                    const res = await fetch(imgUrl);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `마음카드_${expandedCard.name}_${Date.now()}.jpg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(imgUrl, "_blank");
                  }
                }}
                className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-bold text-stone-700 shadow"
              >
                <Download size={15} /> 저장하기
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`"${expandedCard.name}" 카드를 삭제할까요?`)) {
                    handleDelete(expandedCard.id);
                    setExpandedCard(null);
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500 text-white shadow"
                aria-label="삭제"
              >
                <Trash2 size={15} />
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCreditReason(reason: string) {
  if (reason === "signup_bonus") return "가입 축하 크레딧";
  if (reason === "ai_generate") return "AI 배경 생성";
  if (reason.startsWith("purchase:")) {
    const planId = reason.split(":")[1];
    if (planId === "basic") return "기본 플랜 충전";
    if (planId === "standard") return "스탠다드 플랜 충전";
    return "크레딧 충전";
  }
  return "크레딧 변동";
}

function FavoriteMessagesScreen({ onBack, onUse }: { onBack: () => void; onUse: (text: string) => void }) {
  const { favorites, loading, remove } = useFavMessages();
  const purposeLabel: Record<string, string> = {
    birthday: "생일", love: "안부", health: "건강", thanks: "감사",
    comfort: "위로", congrats: "명절", morning: "아침 인사", night: "저녁 인사", hand: "손편지", custom: "기타",
  };

  return (
    <PhoneShell>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft /></button>
        <h1 className="font-black">즐겨찾기 문구</h1>
      </div>
      {loading ? (
        <div className="grid py-16 place-items-center text-sm font-semibold text-stone-500">불러오는 중...</div>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-4 py-14 text-center">
          <div className="text-5xl">🔖</div>
          <p className="mt-3 font-bold text-stone-700">저장된 문구가 없어요.</p>
          <p className="mt-1 text-sm font-semibold text-stone-500">
            카드 만들기에서 마음에 드는 문구 옆<br />북마크 버튼을 눌러 저장해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <article key={fav.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm leading-6 text-stone-800">{fav.text}</p>
              <div className="mt-3 flex items-center justify-between">
                {fav.purpose ? (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-[#7b310d]">
                    {purposeLabel[fav.purpose] ?? fav.purpose}
                  </span>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    onClick={() => onUse(fav.text)}
                    className="rounded-md bg-[#7b310d] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    카드에 사용
                  </button>
                  <button
                    onClick={() => remove(fav.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

export function MyPageScreen() {
  const { user, loading, refresh } = useAuth();
  const { transactions, loading: transactionsLoading, refresh: refreshTransactions } = useCreditTransactions();
  const router = useRouter();
  const [view, setView] = useState<"menu" | "profile" | "purchases" | "notifications" | "favorites">("menu");
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const openProfile = () => {
    setNicknameInput(user?.nickname ?? "");
    setNicknameSaved(false);
    setView("profile");
  };

  const saveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || !user) return;
    setSavingNickname(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: trimmed })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      setNicknameSaved(true);
      setTimeout(() => setView("menu"), 1200);
    } catch {
      // silently fail — user stays on form
    } finally {
      setSavingNickname(false);
    }
  };

  const purchaseTransactions = transactions.filter((tx) => tx.amount > 0);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/login");
  }, [router]);

  if (loading) {
    return (
      <PhoneShell>
        <div className="space-y-4 py-8">
          <div className="h-20 rounded-2xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
        </div>
      </PhoneShell>
    );
  }

  if (!user) {
    return (
      <PhoneShell>
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="text-6xl">💞</div>
          <p className="font-bold text-stone-600">로그인이 필요합니다</p>
          <Link href="/login" className="h-12 w-full max-w-xs flex items-center justify-center rounded-md bg-white border border-stone-200 font-black text-stone-900 shadow-sm">
            Google로 시작하기
          </Link>
        </div>
      </PhoneShell>
    );
  }

  if (view === "profile") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">내 정보 관리</h1>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar url={user.avatarUrl} nickname={user.nickname} size={80} />
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-bold">닉네임</label>
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={20}
              placeholder="닉네임을 입력해주세요"
              className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
            />
            <p className="mt-1 text-right text-xs text-stone-400">{nicknameInput.length}/20</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold">이메일</label>
            <div className="h-12 w-full rounded-md border border-stone-100 bg-stone-50 px-4 flex items-center text-stone-500 text-sm">
              Google 계정으로 연결됨
            </div>
          </div>

          <button
            onClick={saveNickname}
            disabled={savingNickname || !nicknameInput.trim() || nicknameInput.trim() === user.nickname}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-bold text-white disabled:bg-stone-300"
          >
            {nicknameSaved ? (
              <><Check size={18} /> 저장됐어요!</>
            ) : savingNickname ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>
      </PhoneShell>
    );
  }

  if (view === "favorites") {
    return (
      <FavoriteMessagesScreen
        onBack={() => setView("menu")}
        onUse={(text) => {
          writeJson("maumcard:draft", { ...readJson("maumcard:draft", defaultDraft), message: text });
          router.push("/create/message");
        }}
      />
    );
  }

  if (view === "notifications") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">알림 설정</h1>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-4xl">🔔</div>
          <h2 className="mt-3 text-base font-black text-amber-900">이메일 알림 서비스 준비 중</h2>
          <p className="mt-2 text-sm font-semibold text-amber-800 leading-relaxed">
            기념일 D-7, D-1 이메일 알림 기능을 <br />
            <span className="font-black">2026년 7월</span>에 출시할 예정입니다.
          </p>
          <p className="mt-3 text-xs text-amber-700">
            출시되면 등록된 이메일로 자동 알림이 전송됩니다.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white divide-y">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">기념일 D-7 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">기념일 7일 전 이메일 발송</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">기념일 D-1 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">기념일 전날 이메일 발송</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">카드 수신 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">누군가 내게 카드를 보냈을 때</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          Google 계정 이메일로 알림이 발송됩니다.
        </p>
      </PhoneShell>
    );
  }

  if (view === "purchases") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">구매 내역</h1>
          <button onClick={refreshTransactions} className="text-sm font-bold text-[#7b310d]">새로고침</button>
        </div>

        {transactionsLoading ? (
          <div className="grid py-16 place-items-center text-sm font-semibold text-stone-500">
            구매 내역을 불러오고 있어요.
          </div>
        ) : purchaseTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 px-4 py-12 text-center">
            <div className="text-5xl">💳</div>
            <p className="mt-3 font-bold text-stone-700">아직 구매 내역이 없어요.</p>
            <p className="mt-1 text-sm font-semibold text-stone-500">크레딧을 충전하면 이곳에 기록됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseTransactions.map((tx) => (
              <article key={tx.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[#5a240d]">{formatCreditReason(tx.reason)}</h2>
                    <p className="mt-1 text-xs font-semibold text-stone-500">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-[#7b310d]">
                    +{tx.amount}개
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
      <section className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setThemeOpen(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-outline-variant/30 bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container"
          aria-label="디자인 설정"
        >
          <Settings size={19} />
        </button>
        <Avatar url={user.avatarUrl} nickname={user.nickname} size={72} />
        <div>
          <h1 className="text-xl font-black">{user.nickname}님</h1>
          <p className="mt-1 text-sm font-semibold text-stone-600">오늘도 좋은 하루 되세요!</p>
          <div className="mt-2">
            <CreditBalance credits={user.credits} customerName={user.nickname} onCharged={refresh} />
          </div>
        </div>
      </section>
      <div className="mt-7 divide-y rounded-lg border border-stone-200">
        {isAdminEmail(user.email) && (
          <button
            onClick={() => router.push("/admin")}
            className="flex w-full items-center justify-between px-4 py-4 font-semibold text-[#7b310d]"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} />
              관리자 페이지
            </span>
            <ChevronRight size={18} />
          </button>
        )}
        <button onClick={openProfile} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          내 정보 관리<ChevronRight size={18} />
        </button>
        <button onClick={() => router.push("/library")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          내가 만든 카드<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("favorites")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          즐겨찾기 문구<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("purchases")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          구매 내역<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("notifications")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          알림 설정<ChevronRight size={18} />
        </button>
        <button onClick={() => window.alert("고객센터 화면입니다.")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          고객센터<ChevronRight size={18} />
        </button>
        <button onClick={handleSignOut} className="flex w-full items-center justify-between px-4 py-4 font-semibold text-red-500">
          로그아웃<ChevronRight size={18} />
        </button>
      </div>
    </PhoneShell>
  );
}

const ANNIV_TYPE_ICONS: Record<string, string> = {
  birthday: "🎂",
  love: "❤️",
  anniversary: "💍",
  thanks: "🌸",
  friendship: "👫",
  family: "👨‍👩‍👧",
  other: "✨",
};

const ANNIV_TYPE_LABELS: Record<string, string> = {
  birthday: "생일",
  love: "연인",
  anniversary: "기념일",
  thanks: "감사",
  friendship: "우정",
  family: "가족",
  other: "기타",
};

function getDDay(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = new Date(today.getFullYear(), parts[1] - 1, parts[2]);
  if (target.getTime() < today.getTime()) {
    target = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2]);
  }
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "오늘";
  return `D-${diff}`;
}

function formatAnnivDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return "";
  return `${parts[1]}월 ${parts[2]}일`;
}

const ANNIV_TO_PURPOSE: Record<string, Purpose> = {
  birthday: "birthday",
  love: "love",
  anniversary: "love",
  thanks: "thanks",
  friendship: "love",
  family: "health",
  other: "custom",
};

export function AnniversaryScreen() {
  const { items, add, update, remove } = useSupabaseAnniversaries();
  const { items: commonItems } = useCommonAnniversaries();
  const router = useRouter();
  const [, setDraft] = useDraft();
  const [mode, setMode] = useState<"home" | "calendar" | "manage" | "add">("home");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [listPage, setListPage] = useState(0);
  const [listView, setListView] = useState<"page" | "wheel">("page");

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("birthday");
  const [newMemo, setNewMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth - 1, 1).getDay();
  const calDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // unified display items: personal + common anniversaries
  const allDisplayItems = useMemo(() => {
    const personal = items.map((a) => ({
      id: `user-${a.id}`,
      name: a.name,
      date: a.date,
      anniversary_type: a.anniversary_type,
      memo: a.memo ?? null,
      source: "user" as const,
    }));
    const common = commonItems
      .map((item) => {
        const date = getDefaultAnniversaryDate(item);
        if (!date) return null;
        return {
          id: `common-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo ?? null,
          source: "common" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return [...personal, ...common];
  }, [items, commonItems]);

  const calendarDisplayItems = useMemo(() => {
    const personal = items.map((a) => ({
      id: `user-${a.id}`,
      name: a.name,
      date: a.date,
      anniversary_type: a.anniversary_type,
      memo: a.memo ?? null,
      source: "user" as const,
    }));
    const common = commonItems
      .map((item) => {
        const date = getCalendarAnniversaryDate(item, calYear);
        if (!date) return null;
        return {
          id: `common-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo ?? null,
          source: "common" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return [...personal, ...common];
  }, [items, commonItems, calYear]);

  const annivDaysSet = new Set(
    calendarDisplayItems.flatMap((a) => {
      const parts = a.date.split("-").map(Number);
      return parts[1] === calMonth ? [parts[2]] : [];
    }),
  );

  const selectedDayItems = calendarDisplayItems.filter((a) => {
    const parts = a.date.split("-").map(Number);
    return parts[1] === calMonth && parts[2] === selectedDay;
  });

  const categoryOptions = [
    { id: "all", label: "전체" },
    ...Object.entries(ANNIV_TYPE_LABELS).map(([id, label]) => ({ id, label })),
  ];

  const filteredList = [...allDisplayItems]
    .filter((item) => categoryFilter === "all" || item.anniversary_type === categoryFilter)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const safePage = Math.min(listPage, totalPages - 1);
  const pagedItems = filteredList.slice(safePage * pageSize, safePage * pageSize + pageSize);
  // 페이지 모드: 페이지 단위 / 휠 모드: 전체를 스크롤 영역에 표시
  const visibleItems = listView === "wheel" ? filteredList : pagedItems;

  const resetForm = () => {
    setNewName("");
    setNewDate("");
    setNewType("birthday");
    setNewMemo("");
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setMode("add");
  };

  const startEdit = (item: AnnivItem) => {
    setEditingId(item.id);
    setNewName(item.name);
    setNewDate(item.date);
    setNewType(item.anniversary_type);
    setNewMemo(item.memo ?? "");
    setMode("add");
  };

  const handleSave = async () => {
    if (!newName.trim() || !newDate) return;
    setSaving(true);
    try {
      const data = { name: newName.trim(), date: newDate, anniversary_type: newType, memo: newMemo || undefined };
      if (editingId) {
        await update(editingId, data);
      } else {
        await add(data);
      }
      resetForm();
      setMode("manage");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <PhoneShell title="기념일">
      {mode === "home" && (
        <>
          <div className="rounded-lg bg-orange-50 p-5">
            <p className="font-bold leading-7">오늘도 소중한 사람에게 마음을 전해보세요. ❤️</p>
          </div>
          <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-sm text-stone-700">기념일 목록</h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-stone-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setListView("page")}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      listView === "page" ? "bg-white text-[#7b310d] shadow-sm" : "text-stone-500"
                    }`}
                  >
                    페이지
                  </button>
                  <button
                    type="button"
                    onClick={() => setListView("wheel")}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      listView === "wheel" ? "bg-white text-[#7b310d] shadow-sm" : "text-stone-500"
                    }`}
                  >
                    휠
                  </button>
                </div>
                <span className="text-xs font-semibold text-stone-400">
                  {filteredList.length}개
                </span>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categoryOptions.map((option) => {
                const active = categoryFilter === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setCategoryFilter(option.id);
                      setListPage(0);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#7b310d] text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className={`mt-4 space-y-2 ${listView === "wheel" ? "max-h-[50vh] overflow-y-auto overscroll-contain pr-1" : ""}`}>
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
                    <span className="text-2xl">{ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-sm text-stone-900">{item.name}</div>
                      <div className="text-xs text-stone-500">
                        {formatAnnivDate(item.date)} · {ANNIV_TYPE_LABELS[item.anniversary_type] ?? "기타"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const purpose = ANNIV_TO_PURPOSE[item.anniversary_type] ?? "love";
                          setDraft({
                            purpose,
                            name: item.name,
                            recipientPreset: "",
                            honorific: item.anniversary_type === "love" ? "님" : "에게",
                            message: "",
                            bg: "flower",
                            handTone: item.anniversary_type === "love" ? "love" : "general",
                            handMode: "recommend",
                          });
                          router.push("/create/message");
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full bg-[#7b310d] px-4 text-sm font-bold whitespace-nowrap text-white shadow-sm transition active:scale-[0.98]"
                      >
                        카드 만들기
                      </button>
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-[#7b310d]">
                        {getDDay(item.date)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center text-sm font-semibold text-stone-500">
                  선택한 카테고리에 기념일이 없어요.
                </div>
              )}
            </div>

            {listView === "page" && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setListPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="rounded-md border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-xs font-semibold text-stone-500">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="rounded-md border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <AnnivAction icon={<CalendarDays />} title="달력으로 보기" text="기념일을 달력에서 확인하세요." onClick={() => setMode("calendar")} />
            <AnnivAction icon={<Pencil />} title="기념일 관리" text="기념일을 추가하거나 삭제하세요." onClick={() => setMode("manage")} />
          </div>
        </>
      )}

      {mode === "calendar" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode("home")}><ChevronLeft /></button>
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100"><ChevronLeft size={16} /></button>
              <h1 className="font-black">{calYear}년 {calMonth}월</h1>
              <button onClick={nextMonth} className="grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100"><ChevronRight size={16} /></button>
            </div>
            <button onClick={startAdd} className="grid h-9 w-9 place-items-center rounded-full bg-[#7b310d] text-white"><Plus size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="py-1 font-bold text-stone-500 text-xs">{d}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calDays.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative aspect-square rounded-full text-sm font-semibold ${
                  selectedDay === day ? "bg-[#7b310d] text-white" :
                  annivDaysSet.has(day) ? "bg-orange-100 text-[#7b310d]" : ""
                }`}
              >
                {day}
                {annivDaysSet.has(day) && selectedDay !== day && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#7b310d]" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-stone-200 p-4">
            {selectedDayItems.length > 0 ? (
              <div className="space-y-3">
                {selectedDayItems.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}</span>
                      <div>
                        <h2 className="font-black">{item.name}</h2>
                        <p className="text-sm text-stone-600">{ANNIV_TYPE_LABELS[item.anniversary_type] ?? "기타"}</p>
                      </div>
                    </div>
                    {item.memo && <p className="mt-2 text-sm leading-6 text-stone-600">{item.memo}</p>}
                    <button
                      onClick={() => {
                        const purpose = ANNIV_TO_PURPOSE[item.anniversary_type] ?? "love";
                        setDraft({ purpose, message: "", bg: "flower" });
                        router.push("/create/message");
                      }}
                      className="mt-3 grid h-11 w-full place-items-center rounded-md bg-[#7b310d] font-bold text-white text-sm"
                    >
                      카드 만들기
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="py-4 text-center font-semibold text-stone-500">이 날짜의 기념일이 없어요.</p>
                <button onClick={startAdd} className="h-11 w-full rounded-md border border-[#7b310d]-strong font-bold text-[#7b310d] text-sm">기념일 추가하기</button>
              </>
            )}
          </div>
        </>
      )}

      {mode === "manage" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode("home")}><ChevronLeft /></button>
            <h1 className="font-black">기념일 관리</h1>
            <div className="w-10" />
          </div>
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-5xl mb-3">🗓️</div>
              <p className="font-semibold text-stone-500">등록된 기념일이 없어요.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border border-stone-200">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-50 text-xl shrink-0">
                    {ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{item.name}</div>
                    <div className="text-sm text-stone-500">{formatAnnivDate(item.date)} ({getDDay(item.date)})</div>
                  </div>
                  <button
                    onClick={() => startEdit(item)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-orange-50 hover:text-[#7b310d]"
                    aria-label="기념일 수정"
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-500" aria-label="기념일 삭제">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={startAdd} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-bold text-white">
            <Plus size={18} /> 기념일 추가
          </button>
        </>
      )}

      {mode === "add" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => { resetForm(); setMode("manage"); }}><ChevronLeft /></button>
            <h1 className="font-black">{editingId ? "기념일 수정" : "기념일 추가"}</h1>
            <div className="w-10" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold">이름</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 어머니, 친구 민수"
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">날짜</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">종류</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              >
                {Object.entries(ANNIV_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{ANNIV_TYPE_ICONS[k]} {v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">메모 (선택)</label>
              <textarea
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="기념일에 전하고 싶은 말을 적어보세요."
                className="min-h-24 w-full rounded-md border border-stone-200 p-4 outline-none focus:border-[#7b310d] leading-6"
              />
            </div>
            <PrimaryButton onClick={handleSave} disabled={!newName.trim() || !newDate || saving}>
              {saving ? "저장 중..." : editingId ? "수정 저장" : "저장"}
            </PrimaryButton>
            {editingId && (
              <button
                onClick={() => { resetForm(); setMode("manage"); }}
                className="h-12 w-full rounded-md border border-stone-200 font-bold text-stone-600"
              >
                수정 취소
              </button>
            )}
          </div>
        </>
      )}
    </PhoneShell>
  );
}

function AnnivAction({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-orange-50 text-[#7b310d]">{icon}</span>
      <span><strong>{title}</strong><span className="mt-1 block text-sm text-stone-600">{text}</span></span>
    </button>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "홈", icon: Home },
    { href: "/anniversaries", label: "기념일", icon: CalendarDays },
    { href: "/create/background", label: "만들기", icon: Pencil },
    { href: "/library", label: "보관함", icon: Folder },
    { href: "/mypage", label: "마이", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(5.5rem+env(safe-area-inset-bottom))] w-full max-w-none grid-cols-5 rounded-t-2xl border-t border-outline-variant/30 bg-surface-container-low/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur-lg sm:mx-auto sm:h-20 sm:max-w-2xl sm:rounded-t-xl sm:pb-0 lg:max-w-5xl">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center text-sm font-black leading-tight tracking-normal transition active:scale-95 sm:gap-1 sm:rounded-lg sm:py-1.5 ${
              active
                ? "bg-secondary-container/70 text-primary"
                : "text-on-surface-variant opacity-75 hover:bg-surface-variant/50"
            }`}
          >
            <Icon className="h-7 w-7 sm:h-[22px] sm:w-[22px]" strokeWidth={active ? 2.6 : 2} fill={active && href === "/" ? "currentColor" : "none"} />
            <span className="block w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
