// src/app/api/gmail-send/route.js
// Sends email via Gmail API — rate limited, validates input

import { google } from "googleapis";
import { getOAuthClient, isAuthorized } from "@/lib/google";
import { gmailLimiter } from "@/lib/rateLimit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const rl = gmailLimiter("gmail-send");
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests — slow down" }, { status: 429 });
  }

  if (!isAuthorized()) {
    return Response.json({
      error: "Google not authorized. Visit /api/auth/google to connect.",
      authorized: false,
    }, { status: 401 });
  }

  try {
    const { to, subject, body } = await req.json();

    if (!to || !EMAIL_REGEX.test(to)) {
      return Response.json({ error: "Invalid recipient email" }, { status: 400 });
    }
    if (!subject?.trim()) {
      return Response.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!body?.trim()) {
      return Response.json({ error: "Body is required" }, { status: 400 });
    }
    if (body.length > 10000) {
      return Response.json({ error: "Body too long (max 10,000 chars)" }, { status: 400 });
    }

    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    const emailLines = [
      `From: Trafton Rogers <trogers@rogers-websolutions.com>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body,
    ];

    const email = emailLines.join("\r\n");
    const encoded = Buffer.from(email).toString("base64url");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded },
    });

    return Response.json({
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
