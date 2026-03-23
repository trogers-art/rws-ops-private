// src/app/api/auth/callback/route.js
// Step 2 of OAuth: Google redirects here with a code, we exchange for tokens
// After this runs, copy the refresh_token printed to Vercel logs into your env vars

import { getOAuthClient } from "@/lib/google";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json({ error: "No code returned from Google" }, { status: 400 });
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);

    // Log the refresh token — copy this into Vercel env as GOOGLE_REFRESH_TOKEN
    console.log("=== GOOGLE TOKENS RECEIVED ===");
    console.log("refresh_token:", tokens.refresh_token);
    console.log("access_token:", tokens.access_token);
    console.log("==============================");

    return new Response(
      `
      <html><body style="background:#07080b;color:#00e676;font-family:monospace;padding:40px">
        <h2>✓ Google Authorization Complete</h2>
        <p>Copy this refresh token into Vercel as <strong>GOOGLE_REFRESH_TOKEN</strong>:</p>
        <code style="background:#111;padding:12px;display:block;margin:16px 0;word-break:break-all;color:#29b6f6">
          ${tokens.refresh_token || "(check Vercel function logs — token printed there)"}
        </code>
        <p>Once added to Vercel env vars, redeploy and Gmail + Calendar will be live.</p>
        <a href="/" style="color:#00e676">← Back to app</a>
      </body></html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
