import { buildCardBackgroundPrompt } from "@/lib/openai/cardPromptTemplates";
import { enhanceBackgroundPrompt } from "@/lib/openai/backgroundPrompt";

export type AiBackgroundInput = {
  prompt: string;
  promptCode?: string;
  purpose?: string;
  recipient?: string;
  message?: string;
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

export type AiBackgroundResult = {
  buffer?: Buffer;
  externalUrl?: string;
  imagePrompt: string;
  fallback: boolean;
};

export async function generateAiBackground(input: AiBackgroundInput): Promise<AiBackgroundResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      externalUrl: `https://picsum.photos/seed/${encodeURIComponent(input.prompt.slice(0, 40))}/1536/2048`,
      imagePrompt: input.prompt,
      fallback: true,
    };
  }

  const baseImagePrompt = await buildCardBackgroundPrompt({
    purpose: input.purpose,
    promptCode: input.promptCode,
    recipientName: input.recipient,
    message: input.message?.slice(0, 160),
    userPrompt: input.prompt,
  });
  const imagePrompt = await enhanceBackgroundPrompt({ apiKey, basePrompt: baseImagePrompt });

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt: imagePrompt,
      n: 1,
      size: "1536x2048",
      quality: "high",
      output_format: "png",
    }),
  });

  const data = await response.json().catch(() => ({})) as OpenAIImageResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "AI image generation failed.");
  }

  const image = data.data?.[0];
  if (image?.b64_json) {
    return {
      buffer: Buffer.from(image.b64_json, "base64"),
      imagePrompt,
      fallback: false,
    };
  }
  if (image?.url) {
    return { externalUrl: image.url, imagePrompt, fallback: false };
  }

  throw new Error("AI image generation returned no image.");
}

