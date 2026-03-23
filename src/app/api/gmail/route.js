// src/app/api/gmail/route.js
// Fetches real unread emails from trogers@rogers-websolutions.com

import { google } from "googleapis";
import { getOAuthClient, isAuthorized } from "@/lib/google";

export async function GET() {
  if (!isAuthorized()) {
    return Response.json({
      error: "Google not authorized. Visit /api/auth/google to connect.",
      authorized: false,
    }, { status: 401 });
  }

  try {
    const auth = getOAuthClient();
    const gmail = google.gmail({ version: "v1", auth });

    // Fetch up to 10 unread messages
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
      maxResults: 10,
    });

    const messages = list.data.messages || [];

    if (messages.length === 0) {
      return Response.json({ emails: [], count: 0 });
    }

    // Fetch details for each message
    const emails = await Promise.all(
      messages.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msg.data.payload?.headers || [];
        const get = (name) =>
          headers.find((h) => h.name === name)?.value || "";

        return {
          id,
          from: get("From"),
          subject: get("Subject"),
          date: get("Date"),
          snippet: msg.data.snippet || "",
          threadId: msg.data.threadId,
        };
      })
    );

    return Response.json({ emails, count: emails.length, authorized: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
