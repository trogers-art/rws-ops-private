// src/app/api/calendar/route.js
// Fetches real upcoming calendar events

import { google } from "googleapis";
import { getOAuthClient, isAuthorized } from "@/lib/google";

export async function GET(req) {
  if (!isAuthorized()) {
    return Response.json({
      error: "Google not authorized. Visit /api/auth/google to connect.",
      authorized: false,
    }, { status: 401 });
  }

  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });

    const events = (res.data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || "(No title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || null,
      description: e.description || null,
      allDay: !e.start?.dateTime,
    }));

    return Response.json({ events, authorized: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
