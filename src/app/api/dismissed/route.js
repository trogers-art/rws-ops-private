// src/app/api/dismissed/route.js
// Stores dismissed lead names in Redis so they never resurface

import { pipelineLimiter } from "@/lib/rateLimit";

const DISMISSED_KEY = "rws_dismissed_v1";

function isAuthorizedRequest(req) {
  const pin = req.headers.get("x-app-pin");
  const serverPin = process.env.APP_PIN;
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

// GET — load dismissed set
export async function GET(req) {
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const redis = await getRedis();
    if (!redis) return Response.json({ dismissed: [] });
    const dismissed = await redis.get(DISMISSED_KEY) || [];
    return Response.json({ dismissed });
  } catch (err) {
    return Response.json({ dismissed: [], error: err.message });
  }
}

// POST — add a dismissed name
export async function POST(req) {
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { name } = await req.json();
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const redis = await getRedis();
    if (!redis) return Response.json({ success: false });
    const existing = await redis.get(DISMISSED_KEY) || [];
    if (!existing.includes(name)) {
      await redis.set(DISMISSED_KEY, [...existing, name]);
    }
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
