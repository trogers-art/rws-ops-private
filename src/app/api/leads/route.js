// src/app/api/leads/route.js
// Fetches real local businesses from Google Maps via SerpAPI
// Filters for high-rated businesses missing a website — RWS's ideal prospect

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const location = searchParams.get("location") || "Orange County, California";

  if (!query) {
    return Response.json({ error: "Missing query param" }, { status: 400 });
  }

  if (!process.env.SERPAPI_KEY) {
    return Response.json({ error: "SERPAPI_KEY not set in environment" }, { status: 500 });
  }

  try {
    // Hit SerpAPI Google Maps endpoint
    const params = new URLSearchParams({
      engine: "google_maps",
      q: `${query} ${location}`,
      type: "search",
      api_key: process.env.SERPAPI_KEY,
    });

    const res = await fetch(`https://serpapi.com/search?${params}`);
    const data = await res.json();

    if (data.error) {
      return Response.json({ error: data.error }, { status: 400 });
    }

    const results = data.local_results || [];

    // Filter and score prospects
    const prospects = results
      .map(biz => {
        const hasWebsite = !!biz.website;
        const rating = biz.rating || 0;
        const reviews = biz.reviews || 0;
        const claimed = biz.place_id_search !== undefined; // unclaimed listings lack certain fields

        // RWS scoring logic:
        // Best prospects = high reviews, high rating, NO website
        // Good prospects = decent reviews, no website
        // Weak prospects = has a website already
        let grade = "C";
        let gradeReason = "";

        if (!hasWebsite && rating >= 4.0 && reviews >= 10) {
          grade = "A";
          gradeReason = `${reviews} reviews, ${rating}★, no website — perfect fit`;
        } else if (!hasWebsite && reviews >= 5) {
          grade = "B";
          gradeReason = `${reviews} reviews, no website — solid prospect`;
        } else if (!hasWebsite) {
          grade = "B";
          gradeReason = "No website found";
        } else {
          grade = "C";
          gradeReason = "Has website — lower priority";
        }

        return {
          name: biz.title,
          address: biz.address || "",
          city: extractCity(biz.address || ""),
          phone: biz.phone || null,
          website: biz.website || null,
          hasWebsite,
          rating,
          reviews,
          category: biz.type || biz.types?.[0] || query,
          mapsUrl: biz.link || `https://www.google.com/maps/search/${encodeURIComponent(biz.title + " " + (biz.address || ""))}`,
          thumbnail: biz.thumbnail || null,
          grade,
          gradeReason,
        };
      })
      // Sort: A first, then B, then C — within grade sort by review count desc
      .sort((a, b) => {
        const gradeOrder = { A: 0, B: 1, C: 2 };
        if (gradeOrder[a.grade] !== gradeOrder[b.grade]) {
          return gradeOrder[a.grade] - gradeOrder[b.grade];
        }
        return b.reviews - a.reviews;
      });

    return Response.json({
      prospects,
      total: prospects.length,
      aGrade: prospects.filter(p => p.grade === "A").length,
      query,
      location,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function extractCity(address) {
  // Extract city from address string like "123 Main St, Anaheim, CA 92801"
  const parts = address.split(",");
  if (parts.length >= 2) return parts[parts.length - 2].trim();
  return "Orange County";
}
