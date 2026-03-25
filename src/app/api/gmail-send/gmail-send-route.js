// src/app/api/gmail-send/route.js
import { google } from "googleapis";

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

// RFC 2047 Base64 encode — handles unicode, emoji, special chars in subject
function encodeSubject(subject) {
  // Strip any actual newlines that could break the header
  const clean = subject.replace(/[\r\n]+/g, " ").trim();
  // Check if it's pure ASCII — if so, no encoding needed
  if (/^[\x00-\x7F]*$/.test(clean)) return clean;
  // Non-ASCII → Base64 encode per RFC 2047
  return `=?UTF-8?B?${Buffer.from(clean).toString("base64")}?=`;
}

export async function POST(req) {
  const auth = getOAuthClient();

  // Quick auth check
  try {
    await auth.getAccessToken();
  } catch {
    return Response.json(
      { error: "Gmail not authorized. Visit /api/auth/google to connect.", authorized: false },
      { status: 401 }
    );
  }

  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: "Missing to, subject, or body" }, { status: 400 });
    }

    const gmail = google.gmail({ version: "v1", auth });

    // Encode subject safely — this is the fix for the garbled unicode bug
    const encodedSubject = encodeSubject(subject);

    // Build RFC 2822 email
    const emailLines = [
      `From: Trafton Rogers <trogers@rogers-websolutions.com>`,
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
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
      // Return the decoded subject so the UI can preview exactly what was sent
      subjectSent: subject,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
