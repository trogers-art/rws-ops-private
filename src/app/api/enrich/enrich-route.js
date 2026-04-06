// src/app/api/enrich/route.js
// Enriches a lead with email and Instagram:
// 1. Scrape website for email + IG + follow link-in-bio pages
// 2. Apollo.io for owner email
// 3. Serper.dev Google search for Instagram

import { enrichLimiter } from "@/lib/rateLimit";

// Known link-in-bio domains — follow these to find real contact info
const LINK_IN_BIO_DOMAINS = [
  "campsite.bio", "linktree.com", "linktr.ee", "beacons.ai",
  "bio.link", "later.com/bio", "tap.bio", "lnk.bio",
  "allmylinks.com", "linkpop.com", "stan.store",
];

function isLinkInBio(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return LINK_IN_BIO_DOMAINS.some(d => host.includes(d));
  } catch { return false; }
}

function extractEmails(html) {
  const BLOCKLIST = [
    "example.com", "sentry.io", "wix.com", "wordpress", "schema.org",
    "w3.org", "cloudflare", "google.com", "facebook.com", "apple.com",
    "microsoft.com", "amazon.com", "yourcompany", "youremail", "email.com",
  ];
  const matches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return matches.filter(e =>
    !BLOCKLIST.some(b => e.toLowerCase().includes(b)) &&
    !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") &&
    e.length < 100
  );
}

function extractInstagram(html) {
  const match = html.match(/https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?/);
  if (!match) return null;
  const handle = match[2];
  if (["p", "explore", "reel", "stories", "tv"].includes(handle)) return null;
  return {
    url: `https://www.instagram.com/${handle}/`,
    handle: `@${handle}`,
  };
}

async function scrapePage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RWSBot/1.0)" },
      signal: AbortSignal.timeout(7000),
      redirect: "follow",
    });
    return await res.text();
  } catch { return null; }
}

export async function POST(req) {
  const rl = enrichLimiter("enrich");
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests", enriched: false }, { status: 429 });
  }

  try {
    const { name, website, city, category, phone } = await req.json();

    if (!name?.trim()) {
      return Response.json({ error: "Business name required", enriched: false }, { status: 400 });
    }

    const result = {
      email: null,
      emailSource: null,
      instagram: null,
      instagramHandle: null,
      instagramSource: null,
      websiteType: null, // "real" | "link_in_bio" | null
      enriched: false,
    };

    // ── STEP 1: Scrape website / link-in-bio ─────────────────────────────────
    if (website) {
      const isLIB = isLinkInBio(website);
      result.websiteType = isLIB ? "link_in_bio" : "real";

      const html = await scrapePage(website);
      if (html) {
        // Extract email
        const emails = extractEmails(html);
        if (emails.length > 0) {
          result.email = emails[0];
          result.emailSource = isLIB ? "link_in_bio" : "website";
        }

        // Extract Instagram
        if (!isLIB) {
          const ig = extractInstagram(html);
          if (ig) {
            result.instagram = ig.url;
            result.instagramHandle = ig.handle;
            result.instagramSource = "website";
          }
        }

        // If it's a link-in-bio, also look for linked URLs and scrape those
        if (isLIB && !result.email) {
          const linkedUrls = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)]
            .map(m => m[1])
            .filter(u => !isLinkInBio(u) && !u.includes("instagram.com") && !u.includes("facebook.com") && !u.includes("tiktok.com"));

          for (const linkedUrl of linkedUrls.slice(0, 3)) {
            const linkedHtml = await scrapePage(linkedUrl);
            if (linkedHtml) {
              const linkedEmails = extractEmails(linkedHtml);
              if (linkedEmails.length > 0) {
                result.email = linkedEmails[0];
                result.emailSource = "linked_site";
                result.linkedSite = linkedUrl;
                break;
              }
              // Also grab IG from linked site
              if (!result.instagram) {
                const ig = extractInstagram(linkedHtml);
                if (ig) {
                  result.instagram = ig.url;
                  result.instagramHandle = ig.handle;
                  result.instagramSource = "linked_site";
                }
              }
            }
          }
        }
      }
    }

    // ── STEP 2: Apollo for email if still not found ───────────────────────────
    if (!result.email && process.env.APOLLO_API_KEY) {
      try {
        const domain = website
          ? new URL(website).hostname.replace("www.", "")
          : null;

        const apolloRes = await fetch("https://api.apollo.io/v1/people/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          body: JSON.stringify({
            api_key: process.env.APOLLO_API_KEY,
            q_organization_name: name,
            organization_domains: domain && !isLinkInBio(website) ? [domain] : [],
            person_titles: ["owner", "founder", "manager", "operator"],
            per_page: 1,
          }),
        });

        const apolloData = await apolloRes.json();
        const person = apolloData?.people?.[0];
        if (person?.email) {
          result.email = person.email;
          result.emailSource = "apollo";
          result.ownerName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || null;
        }
      } catch {}
    }

    // ── STEP 3: Serper.dev for Instagram if not found ─────────────────────────
    if (!result.instagram && process.env.SERPER_API_KEY) {
      try {
        const serperRes = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: `"${name}" ${city} instagram`,
            num: 5,
            gl: "us",
            hl: "en",
          }),
        });

        const serperData = await serperRes.json();

        for (const r of (serperData.organic || [])) {
          const url = r.link || "";
          if (url.includes("instagram.com/")) {
            const igMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/);
            if (igMatch && !["p", "explore", "reel", "stories", "tv"].includes(igMatch[1])) {
              result.instagram = `https://www.instagram.com/${igMatch[1]}/`;
              result.instagramHandle = `@${igMatch[1]}`;
              result.instagramSource = "google_search";
              break;
            }
          }
        }
      } catch {}
    }

    result.enriched = !!(result.email || result.instagram);
    return Response.json(result);

  } catch (err) {
    return Response.json({ error: err.message, enriched: false }, { status: 500 });
  }
}
