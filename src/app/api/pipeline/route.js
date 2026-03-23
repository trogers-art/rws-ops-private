// src/app/api/pipeline/route.js
// Persistent pipeline storage via Upstash Redis
// Env vars auto-added by Vercel when you connected Upstash:
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const PIPELINE_KEY = "rws_pipeline_v1";

async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// GET — load pipeline
export async function GET() {
  try {
    const redis = await getRedis();
    if (!redis) {
      return Response.json({ pipeline: [], persistent: false, warning: "Upstash not configured" });
    }
    const pipeline = await redis.get(PIPELINE_KEY) || [];
    return Response.json({ pipeline, persistent: true });
  } catch (err) {
    return Response.json({ pipeline: [], persistent: false, error: err.message });
  }
}

// POST — save pipeline
export async function POST(req) {
  try {
    const { pipeline } = await req.json();
    const redis = await getRedis();
    if (!redis) {
      return Response.json({ success: false, warning: "Upstash not configured" });
    }
    await redis.set(PIPELINE_KEY, pipeline);
    return Response.json({ success: true, persistent: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
