// src/app/api/analytics/route.js
// Persists outreach log + niche history in Redis so data survives across browsers/machines

import { pipelineLimiter } from "@/lib/rateLimit";

const OUTREACH_KEY = "rws_outreach_log_v1";
const NICHE_KEY    = "rws_niche_history_v1";

function isAuthorizedRequest(req) {
  const pin       = req.headers.get("x-app-pin");
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

// GET — load both logs
export async function GET(req) {
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const redis = await getRedis();
    if (!redis) return Response.json({ outreachLog: {}, nicheHistory: [] });
    const [outreachLog, nicheHistory] = await Promise.all([
      redis.get(OUTREACH_KEY),
      redis.get(NICHE_KEY),
    ]);
    return Response.json({
      outreachLog:  outreachLog  || {},
      nicheHistory: nicheHistory || [],
    });
  } catch (err) {
    return Response.json({ outreachLog: {}, nicheHistory: [], error: err.message });
  }
}

// POST — update one or both logs
// body: { outreachLog?: {...}, nicheHistory?: [...] }
export async function POST(req) {
  const rl = pipelineLimiter("analytics-post");
  if (!rl.allowed) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body  = await req.json();
    const redis = await getRedis();
    if (!redis) return Response.json({ success: false, warning: "Upstash not configured" });

    const ops = [];
    if (body.outreachLog  !== undefined) ops.push(redis.set(OUTREACH_KEY, body.outreachLog));
    if (body.nicheHistory !== undefined) ops.push(redis.set(NICHE_KEY,    body.nicheHistory));
    await Promise.all(ops);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
