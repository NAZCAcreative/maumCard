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

export async function enhanceBackgroundPrompt({
  apiKey,
  basePrompt,
}: {
  apiKey: string;
  basePrompt: string;
}) {
  const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.5";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "You are an art director for Korean greeting-card backgrounds.",
              "Rewrite the user's image prompt into one polished English image-generation prompt.",
              "Preserve all important intent, recipient context, mood, and text-safe composition constraints.",
              "Do not add text, lettering, logos, watermarks, frames, UI, or borders.",
              "Return only the final prompt text.",
            ].join(" "),
          },
          {
            role: "user",
            content: basePrompt,
          },
        ],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
    if (!res.ok) {
      console.error("OpenAI background prompt enhancement error:", data);
      return basePrompt;
    }

    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim();
    return enhancedPrompt || basePrompt;
  } catch (error) {
    console.error("AI background prompt enhancement failed:", error);
    return basePrompt;
  }
}
