"use client";
import { useState, useEffect } from "react";

// ─── DESIGN SYSTEM ────────────────────────────────────────────────────────────
const C = {
  bg:      "#07080b",
  panel:   "#0d0f14",
  card:    "#111318",
  cardHi:  "#161922",
  border:  "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.1)",
  green:   "#00e676",
  blue:    "#29b6f6",
  amber:   "#ffca28",
  red:     "#ef5350",
  purple:  "#ab47bc",
  muted:   "rgba(255,255,255,0.32)",
  sub:     "rgba(255,255,255,0.55)",
  text:    "rgba(255,255,255,0.88)",
  white:   "#ffffff",
};

const MONO  = "'Azeret Mono', 'IBM Plex Mono', monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const BODY  = "'DM Sans', sans-serif";

const STATUS = {
  new:       { label: "New",       color: C.muted  },
  contacted: { label: "Contacted", color: C.blue   },
  followup:  { label: "Follow-up", color: C.amber  },
  warm:      { label: "Warm",      color: C.green  },
  closed:    { label: "Closed ✓",  color: C.purple },
  cold:      { label: "Cold",      color: C.red    },
};

const RWS_CTX = `You are the AI operations assistant for Rogers Web Solutions (RWS), a web design agency in Anaheim / Orange County, CA run by Trafton Rogers.

KEY FACTS:
- Trafton works a full-time day job 8–5 M–F as a Senior Network Engineer in Anaheim
- RWS builds affordable websites ($500–$1,000) with monthly care plans ($150–$300/mo)
- Target clients: local OC small businesses — trades (HVAC, plumbing, electrical), nail techs, handymen, independent motels, Instagram-based service businesses in Orange County
- Email: trogers@rogers-websolutions.com
- Calendly: calendly.com/trogers-rogers-websolutions/30min
- Only available evenings and weekends — never 8–5 M–F
- Voice: direct, human, confident. No em-dashes. No filler. No "I hope this finds you well."
- Pipeline stages: New → Contacted → Follow-up → Warm → Closed`;

const NICHES = [
  "HVAC companies Orange County no website",
  "nail techs Anaheim Instagram only",
  "handymen Tustin Garden Grove",
  "plumbers Orange County outdated website",
  "electricians Fullerton Anaheim no website",
  "independent motels Orange County",
  "landscapers Anaheim Santa Ana",
];

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function ai(system, user, maxTokens = 1000) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages: [{ role: "user", content: user }], max_tokens: maxTokens }),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message);
    return d.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  } catch (e) { return `⚠ ${e.message}`; }
}

async function fetchGmail() {
  const res = await fetch("/api/gmail");
  return res.json();
}

async function fetchCalendar(days = 7) {
  const res = await fetch(`/api/calendar?days=${days}`);
  return res.json();
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Pill({ color, children, sm }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: sm ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: sm ? "2px 7px" : "3px 9px", borderRadius: 20,
      background: `${color}14`, color, border: `1px solid ${color}28`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Dot({ color, pulse, size = 7 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: `0 0 ${pulse ? 0 : 6}px ${color}80`,
      animation: pulse ? "ripple 2s ease-out infinite" : "none",
    }} />
  );
}

function Btn({ onClick, disabled, loading, children, color = C.green, sm }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      fontFamily: MONO, fontSize: sm ? 10 : 11, letterSpacing: "0.07em", fontWeight: 500,
      padding: sm ? "5px 11px" : "9px 18px", borderRadius: 7,
      cursor: (disabled || loading) ? "not-allowed" : "pointer",
      background: (disabled || loading) ? "rgba(255,255,255,0.03)" : `${color}12`,
      border: `1px solid ${(disabled || loading) ? "rgba(255,255,255,0.07)" : color + "45"}`,
      color: (disabled || loading) ? C.muted : color, transition: "all 0.15s",
    }}>
      {loading ? <span style={{ animation: "blink 0.9s step-start infinite" }}>···</span> : children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "22px 24px", ...style }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>{children}</p>;
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />;
}

function TextBox({ value, loading, placeholder }) {
  if (loading) return <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, padding: "12px 0" }}><span style={{ animation: "blink 0.9s step-start infinite" }}>working···</span></div>;
  if (!value) return <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>{placeholder}</p>;
  return (
    <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.85, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "13px 15px", border: `1px solid ${C.border}` }}>
      {value}
    </div>
  );
}

function Field({ value, onChange, placeholder, rows, onKeyDown }) {
  const shared = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 8, padding: "10px 13px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" };
  return rows
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...shared, resize: "vertical" }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} style={shared} />;
}

// ─── PIN GATE ─────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const CORRECT = process.env.NEXT_PUBLIC_APP_PIN || "1234"; // set in Vercel env

  function check() {
    if (pin === CORRECT) { onUnlock(); }
    else { setError(true); setPin(""); setTimeout(() => setError(false), 1200); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 16px" }}>RWS · Anaheim</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, color: C.white, margin: "0 0 32px" }}>Command Center</h1>
        <input
          type="password" value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && check()}
          placeholder="PIN"
          maxLength={8}
          style={{
            display: "block", width: 180, margin: "0 auto 12px",
            background: error ? "rgba(239,83,80,0.08)" : "rgba(0,0,0,0.4)",
            border: `1px solid ${error ? C.red : C.border2}`,
            borderRadius: 8, padding: "12px 16px", textAlign: "center",
            fontFamily: MONO, fontSize: 20, color: C.text, outline: "none",
            letterSpacing: "0.3em", transition: "all 0.2s",
          }}
        />
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "0 0 12px" }}>incorrect</p>}
        <Btn onClick={check} disabled={pin.length < 1} color={C.green}>Unlock →</Btn>
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} } * { box-sizing:border-box; } button:hover:not(:disabled){opacity:0.8;}`}</style>
    </div>
  );
}

// ─── LOGIN / BRIEFING SCREEN ──────────────────────────────────────────────────
function LoginScreen({ onEnter, onPrepReady }) {
  const [brief, setBrief]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [prepStatus, setPrepStatus] = useState("running");

  const now        = new Date();
  const hour       = now.getHours();
  const greet      = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayStr     = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isWeekend  = [0, 6].includes(now.getDay());
  const todayNiche = NICHES[now.getDay() % NICHES.length];

  useEffect(() => {
    // Brief + prep run in parallel
    const briefP = ai(
      RWS_CTX + `\n\nGenerate a daily briefing. Return ONLY valid JSON, no backticks:
{"synopsis":"2-3 sentences. Day/date. Weekend = no day job. What kind of day this is for RWS.","focus":"Single highest-leverage RWS task today.","tech":"2 sentences on a specific real networking/AI/web infrastructure trend a Senior Network Engineer building a web side business should know. Name actual tech.","motivation":"One punchy grounded sentence. No quotes. Not cheesy."}`,
      `Today: ${dayStr}. Weekend: ${isWeekend}. Hour: ${hour}. Location: Anaheim CA.`
    ).then(raw => {
      try { setBrief(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
      catch { setBrief({ synopsis: `It's ${dayStr}. ${isWeekend ? "No day job today." : "Day job 8–5."} Calendar is clear.`, focus: "Follow up with warm leads, queue two cold DMs.", tech: "AI-native observability tools are shortening incident response cycles — directly relevant to your NetEng work and client uptime conversations.", motivation: "You don't need perfect conditions — you need reps." }); }
      setLoading(false);
    });

    const prepP = (async () => {
      const leadsRaw = await ai(
        RWS_CTX + `\n\nGenerate 6 OC lead prospects. Return ONLY valid JSON array, no backticks:
[{"name":"business name","handle":"@handle or 'no website'","city":"OC city","why":"why they need RWS","angle":"outreach angle"}]`,
        `Niche: ${todayNiche}`, 1200
      );
      let leads = [];
      try { leads = JSON.parse(leadsRaw.replace(/```json|```/g, "").trim()); } catch {}

      const drafts = {};
      await Promise.all(leads.map(async l => {
        const email = await ai(
          RWS_CTX + `\n\nWrite a cold outreach email. Include Subject: line then body. Human, value-first, soft Calendly close. No em-dashes. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com`,
          `To: ${l.name}, ${l.city}. Handle: ${l.handle}. Why RWS: ${l.why}. Angle: ${l.angle}.`
        );
        drafts[l.name] = email;
      }));

      onPrepReady({ leads, drafts, niche: todayNiche });
      setPrepStatus("done");
    })();

    Promise.all([briefP, prepP]);
  }, []);

  const card = (delay, content) => (
    <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "20px 24px", animation: "fadeUp 0.5s ease both", animationDelay: delay, opacity: 0 }}>
      {content}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", backgroundImage: `radial-gradient(ellipse 55% 45% at 50% -5%, rgba(0,230,118,0.06) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 90% 90%, rgba(41,182,246,0.04) 0%, transparent 55%)` }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.4s ease both", opacity: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 10px" }}>Rogers Web Solutions · Anaheim, CA</p>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 700, color: C.white, margin: "0 0 6px" }}>{greet}, Trafton.</h1>
        <p style={{ fontFamily: BODY, fontSize: 14, color: C.sub, margin: 0 }}>{dayStr}</p>
      </div>

      <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {card("0.12s", <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>Day Synopsis</Label>
            <Pill color={loading ? C.amber : C.green}>{loading ? "loading" : "ready"}</Pill>
          </div>
          {loading
            ? <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, animation: "blink 0.9s step-start infinite" }}>generating···</span>
            : <>
                <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.75, color: C.sub, margin: "0 0 12px" }}>{brief?.synopsis}</p>
                {brief?.focus && <div style={{ padding: "9px 13px", background: `${C.green}08`, borderRadius: 8, border: `1px solid ${C.green}20` }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.1em" }}>FOCUS · </span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: C.text }}>{brief.focus}</span>
                </div>}
              </>
          }
        </>)}

        {card("0.24s", <>
          <Label>Tech Pulse</Label>
          {loading
            ? <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, animation: "blink 0.9s step-start infinite" }}>scanning···</span>
            : <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.75, color: C.sub, margin: 0 }}>{brief?.tech}</p>
          }
        </>)}

        {!loading && brief?.motivation && card("0.36s",
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: SERIF, fontSize: 22, color: C.border2, flexShrink: 0 }}>"</span>
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: C.sub, margin: 0, lineHeight: 1.65 }}>{brief.motivation}</p>
          </div>
        )}

        {card("0.46s",
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Label>Today's Leads + Drafts</Label>
              <p style={{ fontFamily: BODY, fontSize: 13, color: C.sub, margin: 0 }}>
                {prepStatus === "running" ? `Generating: ${todayNiche}` : "6 leads + cold emails ready"}
              </p>
            </div>
            <Pill color={prepStatus === "done" ? C.green : C.amber}>{prepStatus === "done" ? "ready" : "prepping"}</Pill>
          </div>
        )}
      </div>

      <button onClick={onEnter} style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "14px 44px", borderRadius: 50, cursor: "pointer", background: `${C.green}14`, border: `1px solid ${C.green}55`, color: C.green, transition: "all 0.2s", animation: "fadeUp 0.5s ease both", animationDelay: "0.5s", opacity: 0 }}>
        {prepStatus === "done" ? "Enter — Leads Ready →" : "Enter Command Center →"}
      </button>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes ripple { 0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)} 100%{box-shadow:0 0 0 12px rgba(0,230,118,0)} }
        *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.8;transform:translateY(-1px)}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
      `}</style>
    </div>
  );
}

// ─── EMAIL MODULE ─────────────────────────────────────────────────────────────
function EmailModule() {
  const [emails, setEmails]     = useState([]);
  const [triage, setTriage]     = useState("");
  const [triaging, setTriaging] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [ctx, setCtx]           = useState("");
  const [draft, setDraft]       = useState("");
  const [drafting, setDrafting] = useState(false);

  async function pullInbox() {
    setTriaging(true); setTriage(""); setAuthError(false);
    const data = await fetchGmail();

    if (data.authorized === false) {
      setAuthError(true); setTriaging(false); return;
    }
    if (data.error) {
      setTriage(`⚠ ${data.error}`); setTriaging(false); return;
    }

    setEmails(data.emails || []);

    if (!data.emails?.length) {
      setTriage("Inbox is clear — no unread messages."); setTriaging(false); return;
    }

    // Send real email data to Claude for triage summary
    const emailSummary = data.emails.map((e, i) =>
      `${i + 1}. FROM: ${e.from}\nSUBJECT: ${e.subject}\nSNIPPET: ${e.snippet}`
    ).join("\n\n");

    const result = await ai(
      RWS_CTX + `\n\nYou are triaging Trafton's real Gmail inbox. For each email, determine:
- Is this a potential RWS lead?
- Does it need an urgent reply?
- What's the recommended action (reply · ignore · follow-up)?
Be direct. Format: FROM / SUBJECT / SUMMARY (1 sentence) / ACTION`,
      `Here are ${data.emails.length} unread emails:\n\n${emailSummary}`
    );
    setTriage(result); setTriaging(false);
  }

  async function draftReply() {
    if (!ctx.trim()) return;
    setDrafting(true); setDraft("");
    const d = await ai(
      RWS_CTX + `\n\nDraft a reply email for Trafton from trogers@rogers-websolutions.com.
Human, direct, short. Lead inquiries: quick value pitch + Calendly link. No em-dashes. No filler openers.
Sign off: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com`,
      ctx
    );
    setDraft(d); setDrafting(false);
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.green} />
        <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Email</span>
        <Pill color={C.green} sm>Gmail</Pill>
      </div>

      <Label>Inbox Triage</Label>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <Btn onClick={pullInbox} loading={triaging} color={C.blue} sm>Pull Real Inbox</Btn>
      </div>

      {authError ? (
        <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "13px 15px" }}>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.amber, margin: "0 0 8px" }}>Google not authorized yet.</p>
          <p style={{ fontFamily: BODY, fontSize: 12, color: C.sub, margin: "0 0 10px" }}>Visit <strong>/api/auth/google</strong> in your browser to connect Gmail. Takes 30 seconds.</p>
          <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Connect Gmail →</a>
        </div>
      ) : (
        <TextBox value={triage} loading={triaging} placeholder="Hit 'Pull Real Inbox' to fetch and triage your actual Gmail." />
      )}

      <Divider />

      <Label>Draft Reply</Label>
      <Field value={ctx} onChange={setCtx} placeholder="Paste the email or describe the situation — e.g. 'Plumber in Anaheim, asking about a website'" rows={3} />
      <div style={{ marginTop: 8 }}>
        <Btn onClick={draftReply} loading={drafting} disabled={!ctx.trim()} color={C.green}>Draft Reply</Btn>
      </div>
      {(drafting || draft) && (
        <div style={{ marginTop: 12 }}>
          <TextBox value={draft} loading={drafting} placeholder="" />
          {draft && <button onClick={() => navigator.clipboard?.writeText(draft)} style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 6, color: C.muted, padding: "5px 12px", cursor: "pointer" }}>Copy</button>}
        </div>
      )}
    </Card>
  );
}

// ─── CALENDAR MODULE ──────────────────────────────────────────────────────────
function CalendarModule() {
  const [events, setEvents]       = useState([]);
  const [summary, setSummary]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [authError, setAuthError] = useState(false);

  async function pullWeek() {
    setLoading(true); setSummary(""); setAuthError(false);
    const data = await fetchCalendar(7);

    if (data.authorized === false) { setAuthError(true); setLoading(false); return; }
    if (data.error) { setSummary(`⚠ ${data.error}`); setLoading(false); return; }

    setEvents(data.events || []);

    if (!data.events?.length) {
      setSummary("Week is clear — no events on Google Calendar."); setLoading(false); return;
    }

    const evtText = data.events.map(e => {
      const start = new Date(e.start);
      return `- ${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${e.allDay ? "(all day)" : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}: ${e.title}${e.location ? ` @ ${e.location}` : ""}`;
    }).join("\n");

    const result = await ai(
      RWS_CTX + `\n\nReview Trafton's upcoming calendar. Flag any events during 8–5 M–F that could conflict with his day job. Note RWS call slots in evenings/weekends. Give a clean day-by-day summary.`,
      `Events next 7 days:\n${evtText}`
    );
    setSummary(result); setLoading(false);
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.blue} />
        <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Calendar</span>
        <Pill color={C.blue} sm>GCal</Pill>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn onClick={pullWeek} loading={loading} color={C.blue}>Pull This Week</Btn>
      </div>

      {authError ? (
        <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "13px 15px" }}>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.amber, margin: "0 0 8px" }}>Google not authorized yet.</p>
          <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Connect Google →</a>
        </div>
      ) : (
        <TextBox value={summary} loading={loading} placeholder="Pull your week — reads your real Google Calendar." />
      )}
    </Card>
  );
}

// ─── LEAD SCRAPER ─────────────────────────────────────────────────────────────
function LeadScraper({ onAdd, prepData }) {
  const [niche, setNiche]   = useState(prepData?.niche || "");
  const [leads, setLeads]   = useState(prepData?.leads || []);
  const [loading, setLoading] = useState(false);
  const [dm, setDm]         = useState("");
  const [dming, setDming]   = useState(false);
  const [added, setAdded]   = useState(new Set());

  async function generate() {
    if (!niche.trim()) return;
    setLoading(true); setLeads([]); setAdded(new Set());
    const raw = await ai(
      RWS_CTX + `\n\nGenerate 8 OC lead prospects. Return ONLY valid JSON array, no backticks:
[{"name":"business name","handle":"@instagram or 'no website'","city":"OC city","why":"why they need RWS","angle":"outreach angle"}]`,
      `Niche: ${niche}`, 1200
    );
    try { setLeads(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
    catch { setLeads([]); }
    setLoading(false);
  }

  async function genDM() {
    if (!niche.trim()) return;
    setDming(true); setDm("");
    const r = await ai(
      RWS_CTX + `\n\nWrite a cold Instagram DM. Under 5 sentences. Real human voice. Genuine opener, fast value, soft Calendly close. No em-dashes. No "I came across your profile." Return ONLY the DM.`,
      `DM for: ${niche}`
    );
    setDm(r); setDming(false);
  }

  function addToPipeline(lead) {
    onAdd(lead);
    setAdded(prev => new Set([...prev, lead.name]));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Dot color={C.amber} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Lead Scraper</span>
          {prepData?.leads?.length > 0 && <Pill color={C.green} sm>pre-loaded</Pill>}
        </div>
        <Field value={niche} onChange={setNiche} placeholder="e.g. nail techs Anaheim, HVAC Orange County, handymen Tustin" onKeyDown={e => e.key === "Enter" && generate()} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn onClick={generate} loading={loading} disabled={!niche.trim()} color={C.amber}>Generate</Btn>
          <Btn onClick={genDM} loading={dming} disabled={!niche.trim()} color={C.green}>Draft DM</Btn>
        </div>
      </Card>

      {(loading || leads.length > 0) && (
        <Card>
          <Label>Prospects — {niche}</Label>
          {loading ? <TextBox value="" loading placeholder="" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leads.map((l, i) => (
                <div key={i} style={{ background: C.cardHi, borderRadius: 9, padding: "13px 15px", border: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 14px", alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>{l.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{l.city}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.blue, marginBottom: 5 }}>{l.handle}</div>
                    <p style={{ fontFamily: BODY, fontSize: 12, color: C.sub, margin: "0 0 3px" }}>{l.why}</p>
                    <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: 0 }}>→ {l.angle}</p>
                  </div>
                  <Btn onClick={() => addToPipeline(l)} disabled={added.has(l.name)} color={added.has(l.name) ? C.purple : C.green} sm>
                    {added.has(l.name) ? "Added ✓" : "+ Pipeline"}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {(dming || dm) && (
        <Card>
          <Label>Cold DM</Label>
          <TextBox value={dm} loading={dming} placeholder="" />
          {dm && <button onClick={() => navigator.clipboard?.writeText(dm)} style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 6, color: C.muted, padding: "5px 12px", cursor: "pointer" }}>Copy DM</button>}
        </Card>
      )}
    </div>
  );
}

// ─── OUTREACH MODULE ──────────────────────────────────────────────────────────
function OutreachModule({ pipeline, prepDrafts }) {
  const [selected, setSelected] = useState(null);
  const [type, setType]         = useState("cold");
  const [output, setOutput]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [custom, setCustom]     = useState("");

  const types = [
    { id: "cold",     label: "Cold Email" },
    { id: "dm",       label: "IG DM"      },
    { id: "followup", label: "Follow-up"  },
    { id: "warm",     label: "Warm Close" },
  ];

  function selectLead(l) {
    setSelected(l); setCustom("");
    setOutput(prepDrafts?.[l.name] && type === "cold" ? prepDrafts[l.name] : "");
  }

  async function generate() {
    const target = selected
      ? `Business: ${selected.name} | City: ${selected.city} | Handle: ${selected.handle} | Why RWS: ${selected.why} | Angle: ${selected.angle}`
      : custom;
    if (!target.trim()) return;
    setLoading(true); setOutput("");
    const prompts = {
      cold:     "Write a cold outreach EMAIL with Subject line. Human, value-first, Calendly close.",
      dm:       "Write a cold Instagram DM. Under 5 sentences. Genuine opener, fast value, soft close. No em-dashes.",
      followup: "Write a follow-up email. No reply to first outreach. Brief, no pressure, one-line re-pitch.",
      warm:     "Write a closing email. They showed interest. Move them to book Calendly. Confident, direct.",
    };
    const r = await ai(RWS_CTX + `\n\n${prompts[type]}\nSign: Trafton Rogers | RWS | trogers@rogers-websolutions.com`, target);
    setOutput(r); setLoading(false);
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.purple} />
        <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Outreach</span>
        {prepDrafts && <Pill color={C.green} sm>{Object.keys(prepDrafts).length} drafts ready</Pill>}
      </div>

      {pipeline.length > 0 && (
        <>
          <Label>Pipeline Leads</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {pipeline.filter(l => ["new","contacted","followup","warm"].includes(l.status)).map(l => (
              <button key={l.id} onClick={() => selectLead(l)} style={{
                fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                background: selected?.id === l.id ? `${C.purple}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${selected?.id === l.id ? C.purple : C.border}`,
                color: selected?.id === l.id ? C.purple : C.sub, transition: "all 0.15s",
              }}>
                {l.name}{prepDrafts?.[l.name] ? " ✓" : ""}
              </button>
            ))}
          </div>
          <Divider />
        </>
      )}

      <Label>Or Describe a Lead</Label>
      <Field value={custom} onChange={v => { setCustom(v); setSelected(null); }} placeholder="e.g. Electrician in Fullerton, runs Instagram only, no website" rows={2} />

      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <Label>Type</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {types.map(t => (
            <button key={t.id} onClick={() => { setType(t.id); if (selected && t.id === "cold" && prepDrafts?.[selected.name]) setOutput(prepDrafts[selected.name]); else setOutput(""); }} style={{
              fontFamily: MONO, fontSize: 10, padding: "6px 13px", borderRadius: 20, cursor: "pointer",
              background: type === t.id ? `${C.purple}18` : "transparent",
              border: `1px solid ${type === t.id ? C.purple : C.border}`,
              color: type === t.id ? C.purple : C.muted, transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <Btn onClick={generate} loading={loading} disabled={!selected && !custom.trim()} color={C.purple}>
        Generate {types.find(t => t.id === type)?.label}
      </Btn>

      {(loading || output) && (
        <div style={{ marginTop: 14 }}>
          <TextBox value={output} loading={loading} placeholder="" />
          {output && <button onClick={() => navigator.clipboard?.writeText(output)} style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 6, color: C.muted, padding: "5px 12px", cursor: "pointer" }}>Copy</button>}
        </div>
      )}
    </Card>
  );
}

// ─── PIPELINE MODULE ──────────────────────────────────────────────────────────
function PipelineModule({ pipeline, onUpdate, onRemove }) {
  const [filter, setFilter] = useState("all");
  const [notes, setNotes]   = useState({});
  const [editing, setEditing] = useState(null);

  const visible = filter === "all" ? pipeline : pipeline.filter(l => l.status === filter);
  const active  = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const closed  = pipeline.filter(l => l.status === "closed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[{ label: "Total", val: pipeline.length, color: C.sub }, { label: "Active", val: active, color: C.green }, { label: "Closed", val: closed, color: C.purple }].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", label: `All (${pipeline.length})` }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: `${s.label} (${pipeline.filter(l => l.status === id).length})` }))].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: filter === f.id ? `${C.green}14` : "transparent", border: `1px solid ${filter === f.id ? C.green : C.border}`, color: filter === f.id ? C.green : C.muted, transition: "all 0.12s" }}>{f.label}</button>
        ))}
      </div>

      {pipeline.length === 0 ? (
        <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", textAlign: "center", margin: 0 }}>No leads yet — generate some in Leads tab</p></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(l => {
            const s = STATUS[l.status];
            return (
              <div key={l.id} style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "15px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>{l.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{l.city}</span>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.blue }}>{l.handle}</span>
                  </div>
                  <Pill color={s.color}>{s.label}</Pill>
                </div>
                <p style={{ fontFamily: BODY, fontSize: 12, color: C.sub, margin: "0 0 12px" }}>{l.why}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {Object.entries(STATUS).map(([id, st]) => (
                    <button key={id} onClick={() => onUpdate(l.id, { status: id })} style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: l.status === id ? `${st.color}18` : "transparent", border: `1px solid ${l.status === id ? st.color : C.border}`, color: l.status === id ? st.color : C.muted, transition: "all 0.12s" }}>{st.label}</button>
                  ))}
                </div>
                {editing === l.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <Field value={notes[l.id] ?? l.notes ?? ""} onChange={v => setNotes(p => ({ ...p, [l.id]: v }))} placeholder="Add notes..." rows={2} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <Btn sm color={C.green} onClick={() => { onUpdate(l.id, { notes: notes[l.id] ?? "" }); setEditing(null); }}>Save</Btn>
                      <Btn sm color={C.muted} onClick={() => setEditing(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: l.notes ? C.sub : "rgba(255,255,255,0.15)" }}>{l.notes || "No notes"}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn sm color={C.blue} onClick={() => { setNotes(p => ({ ...p, [l.id]: l.notes ?? "" })); setEditing(l.id); }}>Notes</Btn>
                      <Btn sm color={C.red} onClick={() => onRemove(l.id)}>Remove</Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── COMMAND CENTER ────────────────────────────────────────────────────────────
function CommandCenter({ prepData }) {
  const [tab, setTab] = useState("leads");
  const [pipeline, setPipeline] = useState(() =>
    (prepData?.leads || []).map(l => ({ id: Date.now() + Math.random(), status: "new", notes: "", addedAt: new Date().toLocaleDateString(), ...l }))
  );

  function addLead(lead) {
    setPipeline(p => [...p, { id: Date.now() + Math.random(), status: "new", notes: "", addedAt: new Date().toLocaleDateString(), ...lead }]);
  }

  const activePipeline = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;

  const tabs = [
    { id: "email",    label: "Email",    dot: C.green  },
    { id: "calendar", label: "Calendar", dot: C.blue   },
    { id: "leads",    label: "Leads",    dot: C.amber  },
    { id: "outreach", label: "Outreach", dot: C.purple },
    { id: "pipeline", label: "Pipeline", dot: C.green, badge: activePipeline || null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: BODY, backgroundImage: `radial-gradient(ellipse 70% 35% at 10% 0%, rgba(0,230,118,0.03) 0%, transparent 50%)` }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dot color={C.green} pulse size={8} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, letterSpacing: "0.04em" }}>RWS Command</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>· ops.rogers-websolutions.com</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[{ c: C.green, l: "Gmail" }, { c: C.blue, l: "GCal" }, { c: C.green, l: "AI" }].map(s => (
              <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Dot color={s.c} size={5} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.id ? C.text : C.muted, borderBottom: `2px solid ${tab === t.id ? t.dot : "transparent"}`, transition: "all 0.15s" }}>
              <Dot color={tab === t.id ? t.dot : C.muted} size={5} />
              {t.label}
              {t.badge && <span style={{ fontFamily: MONO, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}30` }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>
        {tab === "email"    && <EmailModule />}
        {tab === "calendar" && <CalendarModule />}
        {tab === "leads"    && <LeadScraper onAdd={addLead} prepData={prepData} />}
        {tab === "outreach" && <OutreachModule pipeline={pipeline} prepDrafts={prepData?.drafts} />}
        {tab === "pipeline" && <PipelineModule pipeline={pipeline} onUpdate={(id, p) => setPipeline(prev => prev.map(l => l.id === id ? { ...l, ...p } : l))} onRemove={id => setPipeline(prev => prev.filter(l => l.id !== id))} />}
      </div>

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes ripple { 0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)} 100%{box-shadow:0 0 0 12px rgba(0,230,118,0)} }
        * { box-sizing:border-box } button:hover:not(:disabled){opacity:0.78}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
      `}</style>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const [unlocked,  setUnlocked]  = useState(false);
  const [entered,   setEntered]   = useState(false);
  const [prepData,  setPrepData]  = useState(null);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  if (!entered)  return <LoginScreen onEnter={() => setEntered(true)} onPrepReady={setPrepData} />;
  return <CommandCenter prepData={prepData} />;
}
