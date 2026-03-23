// src/app/api/auth/google/route.js
// Step 1 of OAuth: redirects Trafton to Google consent screen
// Visit /api/auth/google once in browser to authorize

import { getOAuthClient } from "@/lib/google";

export async function GET() {
  const client = getOAuthClient();

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces refresh_token to be returned every time
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });

  return Response.redirect(url);
}
