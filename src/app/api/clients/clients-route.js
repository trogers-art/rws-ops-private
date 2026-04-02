// src/app/api/clients/route.js
// Persistent client tracker via Upstash Redis

import { pipelineLimiter } from "@/lib/rateLimit";

const CLIENTS_KEY = "rws_clients_v1";

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

export async function GET(req) {
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const redis   = await getRedis();
    if (!redis) return Response.json({ clients: [], persistent: false });
    const clients = await redis.get(CLIENTS_KEY) || [];
    return Response.json({ clients, persistent: true });
  } catch (err) {
    return Response.json({ clients: [], persistent: false, error: err.message });
  }
}

export async function POST(req) {
  const rl = pipelineLimiter("clients-post");
  if (!rl.allowed) return Response.json({ error: "Too many requests" }, { status: 429 });
  if (!isAuthorizedRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { clients } = await req.json();
    if (!Array.isArray(clients)) return Response.json({ error: "Invalid clients data" }, { status: 400 });
    const redis = await getRedis();
    if (!redis) return Response.json({ success: false, warning: "Upstash not configured" });
    await redis.set(CLIENTS_KEY, clients);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
