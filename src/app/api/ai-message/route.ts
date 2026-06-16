import { NextResponse } from "next/server";

type Purpose =
  | "birthday"
  | "love"
  | "health"
  | "thanks"
  | "comfort"
  | "congrats"
  | "morning"
  | "night"
  | "custom";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const purposeLabels: Record<Purpose, string> = {
  birthday: "생일 축하",
  love: "안부 인사",
  health: "건강 기원",
  thanks: "감사",
  comfort: "위로",
  congrats: "명절 인사",
  morning: "아침 인사",
  night: "저녁 인사",
  custom: "직접 입력용",
};

const fallbackMessages: Record<Purpose, string[]> = {
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
  custom: [
    "마음을 담아 직접 문구를 적어보세요.",
    "전하고 싶은 말이 있다면 그대로 적어도 충분히 따뜻합니다.",
    "짧은 한마디라도 진심이면 오래 남습니다.",
    "당신만의 표현으로 소중한 마음을 전해보세요.",
    "평소 하지 못했던 말을 카드에 담아보세요.",
  ],
};

function isPurpose(value: unknown): value is Purpose {
  return typeof value === "string" && value in purposeLabels;
}

function normalizeMessages(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const messages = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
  return messages.length > 0 ? messages : fallback;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    purpose?: unknown;
    recipient?: unknown;
    honorific?: unknown;
    long?: unknown;
  };

  const purpose = isPurpose(body.purpose) ? body.purpose : "love";
  const recipient = typeof body.recipient === "string" && body.recipient.trim()
    ? body.recipient.trim().slice(0, 30)
    : "소중한 분";
  const honorific = typeof body.honorific === "string" && body.honorific.trim()
    ? body.honorific.trim().slice(0, 12)
    : "님";
  const isLong = body.long === true;
  const fallback = fallbackMessages[purpose];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ messages: fallback, fallback: true });
  }

  try {
    const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";

    const systemPrompt = isLong
      ? [
          "You write warm Korean long-form greeting-card letters.",
          "Return only JSON with a messages array of 3 Korean strings.",
          "Each message must be a heartfelt letter of 120 to 250 Korean characters.",
          "Use natural paragraph breaks with \\n\\n between paragraphs (1-2 paragraphs).",
          "The tone should be warm, sincere, personal — like a handwritten letter.",
          "Do not include markdown, numbering, emojis, hashtags, quotes, or explanations.",
        ].join(" ")
      : [
          "You write warm Korean greeting-card messages.",
          "Return only JSON with a messages array of 5 Korean strings.",
          "Each message must be natural, sincere, non-cliche, and 35 to 80 Korean characters.",
          "Do not include markdown, numbering, emojis, hashtags, quotes, or explanations.",
        ].join(" ");

    const userInstruction = isLong
      ? "받는 사람에게 보내는 따뜻한 장문 편지 3개를 만들어줘. 120자 이상 250자 이하로 작성해줘."
      : "받는 사람에게 바로 보낼 수 있는 카드 문구 5개를 만들어줘.";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              purpose: purposeLabels[purpose],
              recipient,
              honorific,
              instruction: userInstruction,
            }),
          },
        ],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
    if (!res.ok) {
      console.error("OpenAI message generation error:", data);
      return NextResponse.json({ messages: fallback, fallback: true });
    }

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ messages: fallback, fallback: true });

    const parsed = JSON.parse(raw) as { messages?: unknown };
    return NextResponse.json({
      messages: normalizeMessages(parsed.messages, fallback),
      fallback: false,
    });
  } catch (error) {
    console.error("AI message error:", error);
    return NextResponse.json({ messages: fallback, fallback: true });
  }
}
