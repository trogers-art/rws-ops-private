// src/lib/google.js
// Shared Google OAuth2 client used by all API routes

import { google } from "googleapis";

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. https://ops.rogers-websolutions.com/api/auth/callback
  );

  // After first OAuth flow, GOOGLE_REFRESH_TOKEN is set in env
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
  }

  return client;
}

export function isAuthorized() {
  return !!process.env.GOOGLE_REFRESH_TOKEN;
}
