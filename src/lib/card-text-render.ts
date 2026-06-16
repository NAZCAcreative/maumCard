// Design Ref: #2 — 이미지에 텍스트를 직접(로컬) 예쁘게 합성. AI(gpt-image) 합성을 대체하는 기본 렌더 경로.
// 빈영역(card-whitespace)을 탐지해 밴드(상/중/하)에 배치하고, 영역 크기에 맞춰 제목/내용 크기를 자동 핏.
// satori(레이아웃→SVG, 한글 폰트 임베드) + resvg(SVG→PNG) + sharp(배경 처리/밝기 측정).
import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { detectWhitespace } from "@/lib/card-whitespace";
import { CARD_FONT_MAP, resolveCardFontId } from "@/lib/card-fonts";

export const CARD_WIDTH = 1024;
export const CARD_HEIGHT = 1536;

export type CardFont = string; // 폰트 id (card-fonts 레지스트리)
export type TextPosition = "auto" | "top" | "center" | "bottom";

const fontCache: Record<string, Buffer> = {};

function loadFont(fontId: string): { family: string; data: Buffer } {
  const def = CARD_FONT_MAP[resolveCardFontId(fontId)];
  if (!fontCache[def.id]) {
    fontCache[def.id] = fs.readFileSync(path.join(process.cwd(), "public", "fonts", def.file));
  }
  return { family: def.family, data: fontCache[def.id] };
}

// hex 색의 밝기 판단 (relative luminance > 0.62 → 밝은 색)
function isLightHex(hex: string): boolean {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62;
}

// 영역 높이(px)에 맞는 내용 폰트 크기 추정 — 한글은 글자가 거의 정사각이라 글자수 기반 근사.
// 크게(눈에 띄게) 우선: max/min을 대폭 상향.
function fitContentSize(availW: number, availH: number, len: number): number {
  const max = 168;
  const min = 40;
  for (let fs = max; fs >= min; fs -= 2) {
    const charsPerLine = Math.max(1, Math.floor(availW / (fs * 1.02)));
    const lines = Math.max(1, Math.ceil(len / charsPerLine));
    if (lines * fs * 1.5 <= availH) return fs;
  }
  return min;
}

type RenderOpts = {
  recipientLabel: string;
  message: string;
  backgroundBuffer: Buffer;
  accent?: string;
  font?: CardFont; // 공통(레거시) — titleFont/contentFont 없을 때 폴백
  titleFont?: CardFont; // 제목 글씨체
  contentFont?: CardFont; // 내용 글씨체
  position?: TextPosition; // 기본 auto = 빈영역 탐지
  titleScale?: number; // 제목 크기 수동 배율 (기본 1)
  contentScale?: number; // 내용 크기 수동 배율 (기본 1)
  subText?: string; // 추가 문구 (서명/날짜 등, 내용 아래 작게)
  titleColor?: string; // 제목 글자색 (hex 또는 "auto")
  contentColor?: string; // 내용 글자색 (hex 또는 "auto")
};

/**
 * 배경의 빈 영역을 탐지해 해당 밴드에 수신자/메시지를 박스 없이 자동 핏으로 얹어 PNG를 반환.
 */
export async function renderCardImage(opts: RenderOpts): Promise<Buffer> {
  const { recipientLabel, message, backgroundBuffer } = opts;
  const accent = opts.accent ?? "#a8643c";
  const titleScale = opts.titleScale ?? 1;
  const contentScale = opts.contentScale ?? 1;
  const subText = opts.subText?.trim() ?? "";
  // 제목/내용 글씨체 각각 (없으면 공통 font, 그것도 없으면 pen)
  const titleFontDef = loadFont(opts.titleFont ?? opts.font ?? "pen");
  const contentFontDef = loadFont(opts.contentFont ?? opts.font ?? "pen");
  const titleFamily = titleFontDef.family;
  const contentFamily = contentFontDef.family;
  // satori 폰트 등록 (중복 제거)
  const satoriFonts = [
    { name: titleFamily, data: titleFontDef.data, weight: 400 as const, style: "normal" as const },
    ...(contentFamily !== titleFamily
      ? [{ name: contentFamily, data: contentFontDef.data, weight: 400 as const, style: "normal" as const }]
      : []),
  ];

  // 1) 배경을 카드 비율(2:3)로 cover 리사이즈
  const bgPng = await sharp(backgroundBuffer)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const bgDataUri = `data:image/png;base64,${bgPng.toString("base64")}`;

  // 2) 빈영역 탐지 → 가용영역 박스 (x0,y0,x1,y1). 텍스트는 이 박스 안에만 배치/줄바꿈.
  let x0: number, y0: number, x1: number, y1: number;
  if (opts.position && opts.position !== "auto") {
    x0 = 0.08;
    x1 = 0.92;
    const h = 0.34;
    y0 = opts.position === "top" ? 0.06 : opts.position === "bottom" ? 1 - 0.06 - h : 0.5 - h / 2;
    y1 = y0 + h;
  } else {
    const region = await detectWhitespace(bgPng);
    x0 = region.x0;
    y0 = region.y0;
    x1 = region.x1;
    y1 = region.y1;
  }
  const boxX = Math.round(x0 * CARD_WIDTH);
  const boxY = Math.round(y0 * CARD_HEIGHT);
  const boxW = Math.round((x1 - x0) * CARD_WIDTH);
  const boxH = Math.round((y1 - y0) * CARD_HEIGHT);
  const padX = 28;
  const padY = 22;
  const availW = Math.max(140, boxW - padX * 2);
  const availH = Math.max(100, boxH - padY * 2);

  // 3) 자동 핏 크기 (가용영역 폭/높이 기준)
  const hasTitle = recipientLabel.trim().length > 0;
  const titleSize = hasTitle
    ? Math.round(Math.min(176, Math.max(46, (availW / Math.max(2, recipientLabel.length)) * 1.35)) * titleScale)
    : 0;
  const titleBlockH = hasTitle ? titleSize * 1.2 + 14 + 3 + 20 : 0;
  const contentSize = Math.round(fitContentSize(availW, Math.max(40, availH - titleBlockH), message.length) * contentScale);

  // 4) 글자색 — 제목/내용 각각 수동 지정 우선, 없으면 영역 밝기 적응형
  const manualTitle = opts.titleColor && opts.titleColor !== "auto" ? opts.titleColor : null;
  const manualContent = opts.contentColor && opts.contentColor !== "auto" ? opts.contentColor : null;
  let dark = false;
  try {
    const stats = await sharp(bgPng).extract({ left: boxX, top: boxY, width: Math.max(1, boxW), height: Math.max(1, boxH) }).grayscale().stats();
    dark = stats.channels[0].mean < 135;
  } catch {
    // 밝기 측정 실패 시 밝은 배경 가정
  }
  const SHADOW_FOR_LIGHT = "0px 1px 3px rgba(0,0,0,0.6), 0px 0px 2px rgba(0,0,0,0.55)";
  const SHADOW_FOR_DARK = "0px 1px 2px rgba(255,251,244,0.9), 0px 0px 1px rgba(255,251,244,0.9), 0px 1px 3px rgba(60,31,16,0.18)";
  const titleColor = manualTitle ?? (dark ? "#ffe8c8" : accent);
  const contentColor = manualContent ?? (dark ? "#fdf6ec" : "#3b1f10");
  const titleShadow = (manualTitle ? isLightHex(manualTitle) : dark) ? SHADOW_FOR_LIGHT : SHADOW_FOR_DARK;
  const contentShadow = (manualContent ? isLightHex(manualContent) : dark) ? SHADOW_FOR_LIGHT : SHADOW_FOR_DARK;

  // 5) 레이아웃: 텍스트를 가용영역 박스에 절대배치 (박스 안에서만 줄바꿈/정렬)
  const textBox = {
    type: "div",
    props: {
      style: {
        position: "absolute",
        left: boxX,
        top: boxY,
        width: boxW,
        height: boxH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${padY}px ${padX}px`,
      },
      children: buildTextChildren(),
    },
  };

  function buildTextChildren() {
    return [
      ...(hasTitle
        ? [
            {
              type: "div",
              props: {
                style: {
                  fontFamily: titleFamily,
                  fontSize: titleSize,
                  color: titleColor,
                  marginBottom: 14,
                  lineHeight: 1.18,
                  textAlign: "center",
                  textShadow: titleShadow,
                },
                children: recipientLabel,
              },
            },
            {
              type: "div",
              props: { style: { width: 84, height: 4, backgroundColor: titleColor, opacity: 0.6, marginBottom: 20 } },
            },
          ]
        : []),
      {
        type: "div",
        props: {
          style: {
            width: availW,
            fontSize: contentSize,
            color: contentColor,
            lineHeight: 1.5,
            textAlign: "center",
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            textShadow: contentShadow,
          },
          children: message,
        },
      },
      ...(subText
        ? [
            {
              type: "div",
              props: {
                style: {
                  marginTop: Math.round(contentSize * 0.6),
                  fontSize: Math.max(18, Math.round(contentSize * 0.5)),
                  color: contentColor,
                  opacity: 0.92,
                  lineHeight: 1.4,
                  textAlign: "center",
                  whiteSpace: "pre-wrap",
                  wordBreak: "keep-all",
                  width: availW,
                  textShadow: contentShadow,
                },
                children: subText,
              },
            },
          ]
        : []),
    ];
  }

  const tree = {
    type: "div",
    props: {
      style: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: "flex",
        position: "relative",
        fontFamily: contentFamily,
      },
      children: [
        {
          type: "img",
          props: {
            src: bgDataUri,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            style: { position: "absolute", top: 0, left: 0, objectFit: "cover" },
          },
        },
        textBox,
      ],
    },
  };

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: satoriFonts,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();

  return Buffer.from(png);
}
