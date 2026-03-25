// src/app/api/chat/route.js
// Anthropic API proxy — rate limited, validates input

import { chatLimiter } from "@/lib/rateLimit";

export async function POST(req) {
  const rl = chatLimiter("chat");
  if (!rl.allowed) {
    return Response.json({ error: { message: "Too many requests" } }, { status: 429 });
  }

  try {
    const body = await req.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: { message: "Invalid messages" } }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: Math.min(body.max_tokens || 1000, 2000),
        system: body.system,
        messages: body.messages,
      }),
    });

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: { message: err.message } }, { status: 500 });
  }
}
