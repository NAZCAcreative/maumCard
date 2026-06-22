import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAiBackground, type AiBackgroundInput } from "@/lib/generation/ai-background";

export const maxDuration = 300;

type GenerationJob = {
  id: string;
  user_id: string;
  job_type: "ai_background";
  payload: AiBackgroundInput;
  attempts: number;
  max_attempts: number;
};

function hasValidWorkerSecret(request: Request): boolean {
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const candidates = [
    process.env.GENERATION_WORKER_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  return candidates.some((expected) => {
    const expectedBuffer = Buffer.from(expected);
    return expectedBuffer.length === actualBuffer.length
      && timingSafeEqual(expectedBuffer, actualBuffer);
  });
}

async function completeJob(job: GenerationJob) {
  if (job.job_type !== "ai_background") {
    throw new Error(`Unsupported job type: ${job.job_type}`);
  }

  const generated = await generateAiBackground(job.payload);
  let publicUrl = generated.externalUrl;

  if (generated.buffer) {
    const storagePath = `${job.user_id}/${job.id}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("generated-assets")
      .upload(storagePath, generated.buffer, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    publicUrl = supabaseAdmin.storage
      .from("generated-assets")
      .getPublicUrl(storagePath).data.publicUrl;
  }

  const { error } = await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: "completed",
      result: {
        backgroundUrl: publicUrl,
        isAiGenerated: true,
        fallback: generated.fallback,
      },
      error_message: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (error) throw error;
}

async function failJob(job: GenerationJob, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_generation_error";
  const terminal = job.attempts >= job.max_attempts;

  await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: terminal ? "failed" : "queued",
      error_message: message.slice(0, 1000),
      available_at: terminal
        ? new Date().toISOString()
        : new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 1000).toISOString(),
      completed_at: terminal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (terminal) {
    await supabaseAdmin.rpc("refund_generation_job", { p_job_id: job.id });
  }
}

export async function POST(request: Request) {
  if (!process.env.GENERATION_WORKER_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Worker secret is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 5);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 5, 10));
  const { data, error } = await supabaseAdmin.rpc("claim_generation_jobs", { p_limit: limit });
  if (error) {
    console.error("[generation-worker] claim failed:", error);
    return NextResponse.json({ error: "Failed to claim jobs." }, { status: 500 });
  }

  const jobs = (data ?? []) as GenerationJob[];
  const results = await Promise.allSettled(jobs.map(async (job) => {
    try {
      await completeJob(job);
      return { id: job.id, status: "completed" };
    } catch (jobError) {
      console.error(`[generation-worker] job ${job.id} failed:`, jobError);
      await failJob(job, jobError);
      return { id: job.id, status: "retry_or_failed" };
    }
  }));

  return NextResponse.json({
    claimed: jobs.length,
    processed: results.length,
  });
}

export const GET = POST;
