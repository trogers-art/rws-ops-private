// src/app/api/gmail-send/route.js
// Sends email directly from trogers@rogers-websolutions.com via Gmail API

import { google } from "googleapis";
import { getOAuthClient, isAuthorized } from "@/lib/google";

export async function POST(req) {
  if (!isAuthorized()) {
    return Response.json({
      error: "Google not authorized. Visit /api/auth/google to connect.",
      authorized: false,
    }, { status: 401 });
  }

  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: "Missing to, subject, or body" }, { status: 400 });
    }

    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    // Build RFC 2822 email
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
