// src/app/api/pipeline/route.js
// Persistent pipeline storage via Upstash Redis
// Protected by server-side PIN check — APP_PIN env var (NOT NEXT_PUBLIC_)

import { pipelineLimiter } from "@/lib/rateLimit";

const PIPELINE_KEY = "rws_pipeline_v1";

// Server-side PIN check — APP_PIN is never exposed to the client
function isAuthorizedRequest(req) {
  const pin = req.headers.get("x-app-pin");
  const serverPin = process.env.APP_PIN;
  // If no PIN is configured, allow through (backwards compat during setup)
  if (!serverPin) return true;
  return pin === serverPin;
}

async function getRedis() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

export async function GET(req) {
  const rl = pipelineLimiter("pipeline-get");
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!isAuthorizedRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export async function POST(req) {
  const rl = pipelineLimiter("pipeline-post");
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!isAuthorizedRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { pipeline } = await req.json();
    if (!Array.isArray(pipeline)) {
      return Response.json({ error: "Invalid pipeline data" }, { status: 400 });
    }
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
