// src/app/api/leads/route.js
// Fetches real local businesses from Google Maps via Serper.dev
// Shows ALL results — grades A/B/C/D, nothing hidden

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query    = searchParams.get("q");
  const location = searchParams.get("location") || "Orange County, California";

  if (!query) return Response.json({ error: "Missing query param" }, { status: 400 });
  if (!process.env.SERPER_API_KEY) return Response.json({ error: "SERPER_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch("https://google.serper.dev/maps", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${query} ${location}`,
        gl: "us",
        hl: "en",
      }),
    });

    const data = await res.json();

    if (data.error) return Response.json({ error: data.error }, { status: 400 });

    const results = data.places || [];

    const prospects = results
      .map(biz => {
        const website    = biz.website || null;
        const hasWebsite = !!website;
        const rating     = biz.rating  || 0;
        const reviews    = biz.ratingCount || biz.reviews || 0;

        // Detect weak website builders — C grade even with a site
        const weakBuilders = [
          "wix.com", "squarespace.com", "godaddy.com", "weebly.com",
          "jimdo.com", "site123.com", "webflow.io", "wordpress.com", "yolasite.com",
        ];
        const isWeakSite = hasWebsite && weakBuilders.some(b => website?.includes(b));

        let grade, gradeReason;

        if (!hasWebsite && rating >= 4.0 && reviews >= 10) {
          grade       = "A";
          gradeReason = `${reviews} reviews, ${rating}★, no website — perfect fit`;
        } else if (!hasWebsite && (reviews >= 5 || rating >= 3.5)) {
          grade       = "B";
          gradeReason = `${reviews} reviews, ${rating}★, no website — solid prospect`;
        } else if (!hasWebsite) {
          grade       = "B";
          gradeReason = "No website — worth a pitch";
        } else if (isWeakSite) {
          grade       = "C";
          gradeReason = `Has a DIY site (${weakBuilders.find(b => website?.includes(b))}) — redesign opportunity`;
        } else if (hasWebsite && rating >= 4.0 && reviews >= 20) {
          grade       = "C";
          gradeReason = `Has website but strong reviews — care plan or future outreach`;
        } else {
          grade       = "D";
          gradeReason = "Has website — lower priority";
        }

        return {
          name:        biz.title,
          address:     biz.address || "",
          city:        extractCity(biz.address || ""),
          phone:       biz.phoneNumber || null,
          website,
          hasWebsite,
          isWeakSite,
          rating,
          reviews,
          category:    biz.category || biz.type || query,
          mapsUrl:     biz.cid
            ? `https://www.google.com/maps?cid=${biz.cid}`
            : `https://www.google.com/maps/search/${encodeURIComponent((biz.title || "") + " " + (biz.address || ""))}`,
          thumbnail:   biz.thumbnailUrl || null,
          grade,
          gradeReason,
        };
      })
      .sort((a, b) => {
        const order = { A: 0, B: 1, C: 2, D: 3 };
        if (order[a.grade] !== order[b.grade]) return order[a.grade] - order[b.grade];
        return b.reviews - a.reviews;
      });

    return Response.json({
      prospects,
      total:   prospects.length,
      aGrade:  prospects.filter(p => p.grade === "A").length,
      bGrade:  prospects.filter(p => p.grade === "B").length,
      cGrade:  prospects.filter(p => p.grade === "C").length,
      dGrade:  prospects.filter(p => p.grade === "D").length,
      noSite:  prospects.filter(p => !p.hasWebsite).length,
      query,
      location,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function extractCity(address) {
  const parts = address.split(",");
  if (parts.length >= 2) return parts[parts.length - 2].trim();
  return "Orange County";
}
