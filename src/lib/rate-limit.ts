type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

function consumeMemoryLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(options.key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + options.windowSeconds * 1000 }
    : existing;

  entry.count += 1;
  memoryStore.set(options.key, entry);

  if (memoryStore.size > 10_000) {
    for (const [key, value] of memoryStore) {
      if (value.resetAt <= now) memoryStore.delete(key);
    }
  }

  return {
    allowed: entry.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    resetAt: entry.resetAt,
  };
}

async function consumeUpstashLimit(options: RateLimitOptions): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const windowId = Math.floor(Date.now() / (options.windowSeconds * 1000));
  const redisKey = `rate-limit:${options.key}:${windowId}`;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, options.windowSeconds + 1],
    ]),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = await response.json() as Array<{ result?: number }>;
  const count = Number(data[0]?.result ?? 0);
  const resetAt = (windowId + 1) * options.windowSeconds * 1000;

  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await consumeUpstashLimit(options) ?? consumeMemoryLimit(options);
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, using local fallback:", error);
    return consumeMemoryLimit(options);
  }
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

