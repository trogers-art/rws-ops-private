// src/app/api/chat/route.js
// Proxies Anthropic API calls — keeps API key server-side only

export async function POST(req) {
  try {
    const body = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: body.max_tokens || 1000,
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
