// src/app/api/enrich/route.js
// Enriches a lead with email and Instagram:
// 1. If website exists — scrape it for email + Instagram link
// 2. Apollo.io — find owner email by company name + domain
// 3. SerpAPI Google search — find Instagram profile when no website

export async function POST(req) {
  try {
    const { name, website, city, category, phone } = await req.json();

    const result = {
      email: null,
      emailSource: null,
      instagram: null,
      instagramSource: null,
      enriched: false,
    };

    // ── STEP 1: Scrape website for email + Instagram ──────────────────────────
    if (website) {
      try {
        const siteRes = await fetch(website, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RWSBot/1.0)" },
          signal: AbortSignal.timeout(6000),
        });
        const html = await siteRes.text();

        // Extract email addresses
        const emailMatches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
        const filteredEmails = emailMatches.filter(e =>
          !e.includes("example.com") &&
          !e.includes("sentry.io") &&
          !e.includes("wix.com") &&
          !e.includes("wordpress") &&
          !e.includes("schema.org") &&
          !e.includes("w3.org") &&
          !e.endsWith(".png") &&
          !e.endsWith(".jpg")
        );
        if (filteredEmails.length > 0) {
          result.email = filteredEmails[0];
          result.emailSource = "website";
        }

        // Extract Instagram link
        const igMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?/);
        if (igMatch) {
          result.instagram = igMatch[0].split("?")[0]; // strip query params
          result.instagramSource = "website";
        }
      } catch (e) {
        // Site unreachable — continue to other sources
      }
    }

    // ── STEP 2: Apollo for email if not found yet ─────────────────────────────
    if (!result.email && process.env.APOLLO_API_KEY) {
      try {
        const domain = website
          ? new URL(website).hostname.replace("www.", "")
          : null;

        const apolloRes = await fetch("https://api.apollo.io/v1/people/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            api_key: process.env.APOLLO_API_KEY,
            q_organization_name: name,
            organization_domains: domain ? [domain] : [],
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
      } catch (e) {
        // Apollo failed — continue
      }
    }

    // ── STEP 3: SerpAPI Google search for Instagram ───────────────────────────
    if (!result.instagram && process.env.SERPAPI_KEY) {
      try {
        const searchQuery = `${name} ${city} instagram`;
        const params = new URLSearchParams({
          engine: "google",
          q: searchQuery,
          num: "3",
          api_key: process.env.SERPAPI_KEY,
        });

        const serpRes = await fetch(`https://serpapi.com/search?${params}`);
        const serpData = await serpRes.json();

        const organicResults = serpData.organic_results || [];
        for (const r of organicResults) {
          const url = r.link || "";
          if (url.includes("instagram.com/")) {
            // Extract clean IG URL
            const igMatch = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
            if (igMatch && igMatch[1] !== "p" && igMatch[1] !== "explore") {
              result.instagram = `https://www.instagram.com/${igMatch[1]}/`;
              result.instagramHandle = `@${igMatch[1]}`;
              result.instagramSource = "google_search";
              break;
            }
          }
        }
      } catch (e) {
        // SerpAPI failed — continue
      }
    }

    result.enriched = !!(result.email || result.instagram);
    return Response.json(result);

  } catch (err) {
    return Response.json({ error: err.message, enriched: false }, { status: 500 });
  }
}
