// AI(OpenAI gpt-image) 감성 합성 경로. 무료 로컬 렌더(card-text-render.ts)와 분리된 별도 모듈.
// route.ts에서 ai_compose=true 일 때만 호출된다. (기본 카드 생성은 로컬 렌더 사용)
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CARD_WIDTH, CARD_HEIGHT } from "@/lib/card-text-render";

const PROMPT_CODE_SHORT = "COMPOSE_PROMPT";
const PROMPT_CODE_LONG = "COMPOSE_PROMPT_LONG";
const PROMPT_CODE_HAND = "COMPOSE_PROMPT_HAND";
const LONG_MSG_THRESHOLD = 80;

function resolveApiKey(mode: "pay" | "sub"): string {
  const key =
    mode === "sub"
      ? process.env.OPENAI_API_KEY_SUB || process.env.OPENAI_API_KEY
      : process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is not configured");
  return key;
}

const DEFAULT_PROMPT_TEMPLATE = [
  "This is a Korean emotional greeting card background image.",
  "Add handwritten Korean calligraphy (brush calligraphy) text onto this background to create a complete, artistic greeting card.",
  "Calligraphy text to write:",
  `- Header (upper center area): "{name}께" large, expressive Korean brush calligraphy, flowing strokes`,
  `- Body (below header, centered): "{message}" elegant Korean brush calligraphy, multi-line if needed`,
  "Calligraphy style requirements:",
  "- Authentic Korean brush calligraphy style with visible ink brush stroke texture, natural ink flow and slight bleeding at stroke edges",
  "- Ink color: deep warm brown-black (#3b1f10) with ink wash variation",
  "- Behind the calligraphy area: soft parchment or hanji paper-textured translucent panel",
  "- Thin ink brush decorative lines or minimal floral motifs framing the text area",
  "- The background scene must remain beautifully visible around the calligraphy panel",
  "- Portrait orientation 3:4 ratio, no digital font appearance, must look hand-painted",
  "- Korean characters must be perfectly legible and correctly formed",
  "- No watermarks, no borders, no UI elements",
].join(" ");

const promptCache: Record<string, { value: string; at: number }> = {};
const CACHE_TTL = 60_000;

async function getPromptTemplate(isLong: boolean): Promise<string> {
  const code = isLong ? PROMPT_CODE_LONG : PROMPT_CODE_SHORT;
  const now = Date.now();
  if (promptCache[code] && now - promptCache[code].at < CACHE_TTL) return promptCache[code].value;

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .select("template")
    .eq("code", code)
    .maybeSingle();

  if (!error && data?.template?.trim()) {
    promptCache[code] = { value: data.template.trim(), at: now };
    return promptCache[code].value;
  }

  return DEFAULT_PROMPT_TEMPLATE;
}

async function getHandPromptTemplate(): Promise<string> {
  const now = Date.now();
  if (promptCache[PROMPT_CODE_HAND] && now - promptCache[PROMPT_CODE_HAND].at < CACHE_TTL) return promptCache[PROMPT_CODE_HAND].value;

  const { data, error } = await supabaseAdmin
    .from("card_prompt_templates")
    .select("template")
    .eq("code", PROMPT_CODE_HAND)
    .maybeSingle();

  if (!error && data?.template?.trim()) {
    promptCache[PROMPT_CODE_HAND] = { value: data.template.trim(), at: now };
    return promptCache[PROMPT_CODE_HAND].value;
  }

  return [
    "This is a Korean handwritten letter card image.",
    "Create a warm stationery-style composition with a visible paper sheet as the main surface.",
    "Add handwritten Korean text that feels personal, sincere, and hand-written.",
    "The layout should resemble a real letter placed on premium stationery paper.",
    "Use a soft hanji or paper texture with gentle shadows and subtle edges.",
    "Portrait orientation 3:4 ratio, no digital font appearance, must look hand-written.",
    "Korean characters must be perfectly legible and correctly formed.",
    "No watermarks, no borders, no UI elements.",
  ].join(" ");
}

function getHandFontHint(handFont?: string): string {
  if (handFont === "brush") return "Express the text in a bold, hand-brushed Korean calligraphy style with expressive ink texture.";
  if (handFont === "pen") return "Express the text in a thin, natural handwritten pen style with delicate strokes.";
  return "Express the text in a soft rounded handwritten pen style that feels warm and readable.";
}

function getHandToneHint(handTone?: string): string {
  if (handTone === "love") return "The emotional tone should feel like a romantic love letter: fluttering, affectionate, shy, and sincere.";
  return "The emotional tone should feel like a warm personal letter: sincere, gentle, and comforting.";
}

function getHandPaperHint(handPaperEnabled?: boolean, handPaperStyle?: string, handMode?: "recommend" | "direct"): string {
  if (handPaperEnabled === false) return "Do not emphasize a special paper texture; keep the card surface simple and clean.";
  if (handPaperStyle === "linen") return "Use a soft linen-like stationery texture with subtle fibers.";
  if (handPaperStyle === "paper") return "Use a clean premium paper stationery texture.";
  if (handMode === "direct") return "Use a clean stationery texture with subtle paper grain so the handwritten text remains easy to read.";
  if (handMode === "recommend") return "Use a clearly visible stationery sheet or hanji letter paper as the main surface.";
  return "Use a warm hanji paper texture with a traditional Korean feel.";
}

function buildComposePrompt(
  template: string,
  name: string,
  message: string,
  handFont?: string,
  handTone?: string,
  handPaperStyle?: string,
  handPaperEnabled?: boolean,
  handMode?: "recommend" | "direct",
  recipientLabel?: string,
): string {
  const hint = getHandFontHint(handFont);
  const tone = getHandToneHint(handTone);
  const paper = getHandPaperHint(handPaperEnabled, handPaperStyle, handMode);
  const recipient = recipientLabel?.trim() || `${name}께`;
  return `${template
    .replace(/\{name\}께/g, recipient)
    .replace(/\{name\}/g, name)
    .replace(/\{message\}/g, message)} Handwriting style hint: ${hint} Emotional tone hint: ${tone} Paper texture hint: ${paper}`;
}

export type AiComposeOpts = {
  backgroundBuffer: Buffer;
  name: string;
  message: string;
  purpose: string;
  handFont?: string;
  handTone?: string;
  handPaperStyle?: string;
  handPaperEnabled?: boolean;
  handMode?: "recommend" | "direct";
  recipientLabel?: string;
  apiMode: "pay" | "sub";
};

/**
 * 배경 위에 OpenAI gpt-image로 한글 캘리그라피를 합성한다.
 * (비용/지연 발생 — 무료 기본 경로는 card-text-render.renderCardImage 사용)
 */
export async function composeCardWithAI(
  opts: AiComposeOpts,
): Promise<{ imageBuffer: Buffer; prompt: string; model: string }> {
  const { backgroundBuffer, name, message, purpose, handFont, handTone, handPaperStyle, handPaperEnabled, handMode, recipientLabel, apiMode } = opts;
  const apiKey = resolveApiKey(apiMode);

  const resized = await sharp(backgroundBuffer)
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();

  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const isHand = purpose === "hand";
  const isLong = message.length >= LONG_MSG_THRESHOLD;
  const template = isHand ? await getHandPromptTemplate() : await getPromptTemplate(isLong);
  const prompt = buildComposePrompt(template, name, message, handFont, handTone, handPaperStyle, handPaperEnabled, handMode, recipientLabel);

  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", prompt);
  formData.append("n", "1");
  formData.append("size", "1024x1536");
  formData.append("quality", "high");
  formData.append("output_format", "png");
  formData.append("image", new Blob([new Uint8Array(resized)], { type: "image/png" }), "background.png");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  type OAIResp = { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  const data = (await res.json().catch(() => ({}))) as OAIResp;
  if (!res.ok) throw new Error(data.error?.message ?? "OpenAI image composition failed");

  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  if (b64) return { imageBuffer: Buffer.from(b64, "base64"), prompt, model };
  if (url) {
    const imgRes = await fetch(url);
    return { imageBuffer: Buffer.from(await imgRes.arrayBuffer()), prompt, model };
  }
  throw new Error("OpenAI response did not include an image");
}
