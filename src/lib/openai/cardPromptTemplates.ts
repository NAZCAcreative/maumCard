import { supabaseAdmin } from "@/lib/supabase/admin";

type CardPromptTemplate = {
  code: string;
  purpose: string;
  description: string;
  template: string;
  style: string;
};

type PromptContext = {
  purpose?: string;
  promptCode?: string;
  recipientName?: string;
  message?: string;
  userPrompt?: string;
};

const BASE_SENIOR_CARD = [
  "Create a beautiful vertical background image for a heartfelt Korean greeting card.",
  "Audience: senior-friendly Korean card design for parents and older family members.",
  "Mood: warm, sincere, graceful, nostalgic, comforting, and refined.",
  "Composition: reserve a large calm luminous text-safe area in the middle to lower-middle of the image.",
  "Leave the central 60 percent visually quiet with soft paper-like light, low texture, and gentle gradients.",
  "Keep flowers, scenery, ornaments, and important visual elements around the edges and corners.",
  "Use soft watercolor or refined digital painting aesthetics with warm but restrained colors.",
  "Do not include text, letters, logos, watermarks, UI, frames, or borders.",
].join("\n");

const FALLBACK_TEMPLATES: CardPromptTemplate[] = [
  {
    code: "BIRTHDAY_FLOWER_WARM",
    purpose: "birthday",
    description: "생일을 맞은 사람에게 따뜻한 축하와 건강을 기원하는 카드.",
    template: [
      "{BASE_SENIOR_CARD}",
      "",
      "이번 카드는 생일 축하 카드다.",
      '받는 사람 이름은 "{recipientName}"이다.',
      '카드 문구는 "{message}"이다.',
      "",
      "디자인 방향:",
      "- 생일 케이크보다 꽃과 따뜻한 축복 중심",
      "- 부모님 세대가 좋아할 부드러운 축하 분위기",
      "- 과하게 화려하지 않고 정갈한 생일 축하 감성",
      "- 꽃잎, 은은한 빛, 따뜻한 배경 사용",
      "- 문구가 가장 잘 보이도록 여백 확보",
      "",
      "사용자가 추가로 요청한 분위기:",
      "{userPrompt}",
    ].join("\n"),
    style: "soft flower background, warm birthday blessing, elegant pastel floral card",
  },
  {
    code: "GENERIC_SENIOR_CARD",
    purpose: "generic",
    description: "받는 사람에게 따뜻한 마음을 전하는 정갈한 카드.",
    template: [
      "{BASE_SENIOR_CARD}",
      "",
      '받는 사람 이름은 "{recipientName}"이다.',
      '카드 문구는 "{message}"이다.',
      "",
      "디자인 방향:",
      "- 문구가 가장 잘 보이도록 여백 확보",
      "- 차분하고 따뜻한 축복의 분위기",
      "- 과하게 화려하지 않은 정갈한 카드 감성",
      "",
      "사용자가 추가로 요청한 분위기:",
      "{userPrompt}",
    ].join("\n"),
    style: "soft warm greeting-card background, elegant pastel tone, calm text-safe composition",
  },
];

function fallbackForPurpose(purpose?: string) {
  return (
    FALLBACK_TEMPLATES.find((template) => template.purpose === purpose) ??
    FALLBACK_TEMPLATES.find((template) => template.purpose === "generic") ??
    FALLBACK_TEMPLATES[0]
  );
}

function replaceTokens(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (next, [key, replacement]) => next.replaceAll(`{${key}}`, replacement),
    value,
  );
}

async function fetchTemplate(purpose?: string, promptCode?: string) {
  try {
    let query = supabaseAdmin
      .from("card_prompt_templates")
      .select("code,purpose,description,template,style")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(1);

    if (promptCode) {
      query = query.eq("code", promptCode);
    } else if (purpose) {
      query = query.eq("purpose", purpose);
    }

    const { data, error } = await query.maybeSingle<CardPromptTemplate>();
    if (error) {
      console.error("Card prompt template lookup failed:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Card prompt template lookup error:", error);
    return null;
  }
}

export async function buildCardBackgroundPrompt({
  purpose,
  promptCode,
  recipientName,
  message,
  userPrompt,
}: PromptContext) {
  const template =
    (await fetchTemplate(purpose, promptCode)) ?? fallbackForPurpose(purpose);

  const renderedTemplate = replaceTokens(template.template, {
    BASE_SENIOR_CARD,
    recipientName: recipientName?.trim() || "받는 분",
    message: message?.trim() || "따뜻한 마음을 전하는 문구",
    userPrompt: userPrompt?.trim() || "No extra user mood request.",
  });

  return [
    `Prompt template code: ${template.code}`,
    `Purpose: ${template.purpose}`,
    `Goal: ${template.description}`,
    renderedTemplate,
    "Background style:",
    template.style,
  ].join("\n\n");
}
