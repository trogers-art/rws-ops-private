"use client";
import { useState, useEffect, useRef } from "react";

const C = {
  bg:      "#07080b",
  sidebar: "#0d0f14",
  card:    "#111318",
  cardHi:  "#161922",
  border:  "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.1)",
  green:   "#00e676",
  blue:    "#29b6f6",
  amber:   "#ffca28",
  red:     "#ef5350",
  purple:  "#ab47bc",
  teal:    "#26c6da",
  muted:   "rgba(255,255,255,0.30)",
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
  closed:    { label: "Closed",    color: C.purple },
  cold:      { label: "Cold",      color: C.red    },
};

const GRADE_COLOR = { A: C.green, B: C.amber, C: C.blue, D: C.muted };

// 3-7-7 cadence — first follow-up at day 3, second bump at +7d, re-engage at +90d cold
const CADENCE = {
  firstFollowUpDays:  3,   // days after contactedAt to surface first follow-up
  secondBumpDays:     7,   // days after firstFollowUpAt to surface second bump
  reEngageDays:       90,  // days after coldAt to re-surface
};

const TECH_TOPICS = [
  "AI/LLM tooling, inference optimization, or agent frameworks",
  "Network observability, eBPF, or modern monitoring stacks",
  "Edge computing, CDN architecture, or serverless patterns",
  "Web performance, Core Web Vitals, or frontend infrastructure",
  "Security, zero-trust networking, or API threat landscape",
  "Database, caching, or data pipeline trends",
  "Developer tools, CI/CD, or deployment automation",
];

const RWS_CTX = `You are the AI operations assistant for Rogers Web Solutions (RWS), a web design agency in Anaheim / Orange County, CA run by Trafton Rogers.

KEY FACTS:
- Trafton works a full-time day job 8-5 M-F as a Senior Network Engineer in Anaheim
- RWS builds affordable websites ($500-$1,000) with monthly care plans ($150-$300/mo)
- Target clients: local OC small businesses - trades (HVAC, plumbing, electrical), nail techs, handymen, independent motels, Instagram-based service businesses
- Email: trogers@rogers-websolutions.com | Book a call: https://www.rogers-websolutions.com/book
- Only available evenings and weekends

TRAFTON'S VOICE - follow this exactly:
- Lead with one specific observation about THIS business. Not a generic opener.
- State the practical gap plainly. One sentence. Do not explain what it costs them or lecture them about it.
- Never tell them they are losing business, losing clients, or falling behind competitors. They know their business. That framing is condescending and kills replies.
- Never use competitor framing. Do not mention what competitors are doing.
- Short. Every word earns its place.
- Low-pressure close. One sentence. Send them to rogers-websolutions.com/book.
- NEVER say: leverage, digital footprint, online presence, I'd love the opportunity, I hope this finds you well, we help businesses grow, which means, that means, missing out
- NEVER use em-dashes, exclamation points, or fake casual openers like "Hey!" or "Hope you're well"
- NEVER invent data. Only use facts provided about the actual business.
- DMs are for beauty/service Instagram businesses ONLY. Trades get email.

EMAIL SIGNATURE - always end emails with exactly this, on its own line:
Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com

DM SIGN-OFF - always end DMs with this on its own line:
Trafton @ Rogers Web Solutions`;

const NICHES = [
  { query: "nail salons",          location: "Westminster, CA",       priority: "high" },
  { query: "nail salons",          location: "Garden Grove, CA",      priority: "high" },
  { query: "nail salons",          location: "Santa Ana, CA",         priority: "high" },
  { query: "lash extensions",      location: "Westminster, CA",       priority: "high" },
  { query: "lash extensions",      location: "Fountain Valley, CA",   priority: "high" },
  { query: "microblading",         location: "Garden Grove, CA",      priority: "high" },
  { query: "handyman",             location: "Anaheim, CA",           priority: "high" },
  { query: "handyman",             location: "Fullerton, CA",         priority: "high" },
  { query: "pressure washing",     location: "Orange County, CA",     priority: "high" },
  { query: "mobile car detailing", location: "Orange County, CA",     priority: "high" },
  { query: "motels",               location: "Harbor Blvd Anaheim",   priority: "high" },
  { query: "motels",               location: "Garden Grove, CA",      priority: "high" },
  { query: "HVAC companies",       location: "Anaheim, CA",           priority: "medium" },
  { query: "plumbers",             location: "Fullerton, CA",         priority: "medium" },
  { query: "electricians",         location: "Santa Ana, CA",         priority: "medium" },
  { query: "painters",             location: "Buena Park, CA",        priority: "medium" },
  { query: "landscapers",          location: "Anaheim, CA",           priority: "medium" },
  { query: "house cleaners",       location: "Tustin, CA",            priority: "medium" },
  { query: "spray tan studios",    location: "Orange County, CA",     priority: "medium" },
  { query: "mobile pet groomers",  location: "Orange County, CA",     priority: "medium" },
  { query: "mobile notary",        location: "Orange County, CA",     priority: "medium" },
  { query: "permanent makeup",     location: "Mission Viejo, CA",     priority: "medium" },
  { query: "motels",               location: "Buena Park, CA",        priority: "medium" },
  { query: "lash extensions",      location: "Santa Ana, CA",         priority: "medium" },
];

// --- API HELPERS --------------------------------------------------------------
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
  } catch (e) { return `Error: ${e.message}`; }
}

async function enrichLead(lead) {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lead.name, website: lead.website, city: lead.city, category: lead.category, phone: lead.phone }),
    });
    return await res.json() || { enriched: false };
  } catch (e) { return { enriched: false, error: e.message }; }
}

async function fetchLeads(query, location = "Orange County, California") {
  const res = await fetch(`/api/leads?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`);
  return res.json();
}

async function sendEmail(to, subject, body) {
  try {
    const res = await fetch("/api/gmail-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { success: false, error: `Non-JSON response (${res.status}): ${text.slice(0, 120)}` }; }
  } catch (e) { return { success: false, error: e.message }; }
}

const PIN_HEADER = () => ({ "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "" });

async function loadPipeline() {
  try {
    const res = await fetch("/api/pipeline", { headers: PIN_HEADER() });
    const d   = await res.json();
    return d.pipeline || [];
  } catch { return []; }
}

async function savePipeline(pipeline) {
  try {
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...PIN_HEADER() },
      body: JSON.stringify({ pipeline }),
    });
  } catch {}
}

async function loadClients() {
  try {
    const res = await fetch("/api/clients", { headers: PIN_HEADER() });
    const d   = await res.json();
    return d.clients || [];
  } catch { return []; }
}

async function saveClients(clients) {
  try {
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...PIN_HEADER() },
      body: JSON.stringify({ clients }),
    });
  } catch {}
}

async function loadAnalytics() {
  try {
    const res = await fetch("/api/analytics", { headers: PIN_HEADER() });
    return await res.json();
  } catch { return { outreachLog: {}, nicheHistory: [], nicheWeek: { weekStart: "", used: [] } }; }
}

async function saveOutreachLog(outreachLog) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...PIN_HEADER() },
      body: JSON.stringify({ outreachLog }),
    });
  } catch {}
}

async function saveNicheHistory(nicheHistory) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...PIN_HEADER() },
      body: JSON.stringify({ nicheHistory }),
    });
  } catch {}
}

async function saveNicheWeek(nicheWeek) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...PIN_HEADER() },
      body: JSON.stringify({ nicheWeek }),
    });
  } catch {}
}

let _outreachLog     = {};
let _nicheHistory    = [];
let _nicheWeek       = { weekStart: "", used: [] };
let _analyticsLoaded = false;

function todayKey() { return new Date().toLocaleDateString("en-CA"); }

function getWeekStart() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(new Date().setDate(diff)).toLocaleDateString("en-CA");
}

async function ensureAnalyticsLoaded() {
  if (_analyticsLoaded) return;
  const data       = await loadAnalytics();
  _outreachLog     = data.outreachLog  || {};
  _nicheHistory    = data.nicheHistory || [];
  _nicheWeek       = data.nicheWeek    || { weekStart: getWeekStart(), used: [] };
  _analyticsLoaded = true;
}

function logOutreach(type) {
  const key = todayKey();
  if (!_outreachLog[key]) _outreachLog[key] = { dms: 0, emails: 0 };
  _outreachLog[key][type]++;
  const keys = Object.keys(_outreachLog).sort().slice(-30);
  const trimmed = {};
  keys.forEach(k => { trimmed[k] = _outreachLog[k]; });
  _outreachLog = trimmed;
  saveOutreachLog(_outreachLog);
}

function nicheKey(niche) { return `${niche.query} :: ${niche.location}`; }

function logNicheSearch(dateKey, niche, aCount, bCount) {
  const key = nicheKey(niche);
  _nicheHistory.push({ query: key, date: dateKey, aCount, bCount, total: aCount + bCount });
  _nicheHistory = _nicheHistory.slice(-200);
  saveNicheHistory(_nicheHistory);
}

function pickTodayNiche() {
  const weekStart = getWeekStart();
  if (_nicheWeek.weekStart !== weekStart) _nicheWeek = { weekStart, used: [] };
  const available    = NICHES.filter(n => !_nicheWeek.used.includes(nicheKey(n)));
  const highPriority = available.filter(n => n.priority === "high");
  const pool         = highPriority.length > 0 ? highPriority : (available.length > 0 ? available : NICHES);
  const dayOfYear    = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

function markNicheUsed(niche) {
  const key = nicheKey(niche);
  if (!_nicheWeek.used.includes(key)) {
    _nicheWeek = { ..._nicheWeek, used: [..._nicheWeek.used, key] };
    saveNicheWeek(_nicheWeek);
  }
}

function getWeekLog() {
  let dms = 0, emails = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    if (_outreachLog[key]) { dms += _outreachLog[key].dms || 0; emails += _outreachLog[key].emails || 0; }
  }
  return { dms, emails, today: _outreachLog[todayKey()] || { dms: 0, emails: 0 } };
}

async function dismissLead(name) {
  try {
    await fetch("/api/dismissed", { method: "POST", headers: { "Content-Type": "application/json", ...PIN_HEADER() }, body: JSON.stringify({ name }) });
  } catch {}
}

async function loadDismissed() {
  try {
    const res = await fetch("/api/dismissed", { headers: PIN_HEADER() });
    const d   = await res.json();
    return new Set(d.dismissed || []);
  } catch { return new Set(); }
}

// --- FOLLOW-UP HELPERS (3-7-7 cadence) ---------------------------------------
function daysSince(isoStr) {
  if (!isoStr) return null;
  const ts = Date.parse(isoStr);
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

// 3-7-7 cadence:
// - Day 0: status set to "contacted", contactedAt stamped
// - Day 3+: surface "first follow-up due" (was day 4)
// - When status flips to "followup", firstFollowUpAt is stamped
// - 7+ days after firstFollowUpAt: surface "second bump due" (was 4 days after first)
// Total cadence: contact → +3d → +7d = day 10, matching the research's "93% of replies by day 10"
function followUpStatus(lead) {
  if (lead.status === "contacted") {
    const days = daysSince(lead.contactedAt);
    if (days === null) return null;
    if (days >= CADENCE.firstFollowUpDays) return { label: `${days}d — follow-up due`, color: C.amber, urgent: true };
    if (days >= 1)                          return { label: `${days}d — sent`,         color: C.blue,  urgent: false };
    return { label: `sent today`, color: C.blue, urgent: false };
  }
  if (lead.status === "followup") {
    // Prefer firstFollowUpAt; fall back to contactedAt for legacy leads that pre-date the new field
    const anchor = lead.firstFollowUpAt || lead.contactedAt;
    const days   = daysSince(anchor);
    if (days === null) return null;
    if (days >= CADENCE.secondBumpDays) return { label: `${days}d — second bump due`, color: C.red,   urgent: true };
    return { label: `${days}d since follow-up`, color: C.muted, urgent: false };
  }
  return null;
}

// 90-day re-engage check for cold leads
function isReEngageReady(lead) {
  if (lead.status !== "cold") return false;
  const anchor = lead.coldAt || lead.contactedAt;
  const days   = daysSince(anchor);
  return days !== null && days >= CADENCE.reEngageDays;
}

function daysCold(lead) {
  if (lead.status !== "cold") return null;
  return daysSince(lead.coldAt || lead.contactedAt);
}

// --- SHARED UI ----------------------------------------------------------------
function Pill({ color, children, sm }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: sm ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: sm ? "2px 7px" : "3px 9px", borderRadius: 20, background: `${color}14`, color, border: `1px solid ${color}28`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Dot({ color, pulse, size = 7 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: pulse ? `0 0 0 0 ${color}` : `0 0 6px ${color}80`, animation: pulse ? "ripple 2s ease-out infinite" : "none" }} />;
}

function Btn({ onClick, disabled, loading, children, color = C.green, sm }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ fontFamily: MONO, fontSize: sm ? 10 : 11, letterSpacing: "0.07em", fontWeight: 500, padding: sm ? "5px 11px" : "9px 18px", borderRadius: 7, cursor: (disabled || loading) ? "not-allowed" : "pointer", background: (disabled || loading) ? "rgba(255,255,255,0.03)" : `${color}12`, border: `1px solid ${(disabled || loading) ? "rgba(255,255,255,0.07)" : color + "45"}`, color: (disabled || loading) ? C.muted : color, transition: "all 0.15s" }}>
      {loading ? <span style={{ animation: "blink 0.9s step-start infinite" }}>...</span> : children}
    </button>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "22px 24px", ...style }}>{children}</div>;
}

function Label({ children }) {
  return <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>{children}</p>;
}

function Divider() {
  return <div style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />;
}

function TextBox({ value, loading, placeholder }) {
  if (loading) return <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, padding: "12px 0" }}><span style={{ animation: "blink 0.9s step-start infinite" }}>working...</span></div>;
  if (!value)  return <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>{placeholder}</p>;
  return <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.85, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "13px 15px", border: `1px solid ${C.border}` }}>{value}</div>;
}

function Field({ value, onChange, placeholder, rows, onKeyDown }) {
  const shared = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 8, padding: "10px 13px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" };
  return rows
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...shared, resize: "vertical" }} />
    : <input    value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} style={shared} />;
}

function CopyBtn({ text, label = "Copy", sm, onCopy }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  }
  return <Btn onClick={copy} color={copied ? C.green : C.muted} sm={sm}>{copied ? "Copied" : label}</Btn>;
}

function Section({ title, color = C.muted, count, defaultOpen = false, children, urgentBorder = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: urgentBorder ? `${C.red}06` : C.card, border: `1px solid ${urgentBorder ? C.red + "35" : C.border2}`, borderRadius: 8, cursor: "pointer", marginBottom: open ? 8 : 0, transition: "background 0.12s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Dot color={color} size={6} pulse={urgentBorder} />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: urgentBorder ? C.red : C.text }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontFamily: MONO, fontSize: 8, padding: "1px 7px", borderRadius: 20, background: `${color}12`, color, border: `1px solid ${color}20` }}>{count}</span>
          )}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
      </div>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>}
    </div>
  );
}

// --- PIN GATE -----------------------------------------------------------------
function PinGate({ onUnlock }) {
  const [pin, setPin]     = useState("");
  const [error, setError] = useState(false);
  const CORRECT = process.env.NEXT_PUBLIC_APP_PIN || "1234";
  function check() {
    if (pin === CORRECT) { onUnlock(); }
    else { setError(true); setPin(""); setTimeout(() => setError(false), 1200); }
  }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 16px" }}>RWS  Anaheim</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, color: C.white, margin: "0 0 32px" }}>Command Center</h1>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder="PIN" maxLength={8}
          style={{ display: "block", width: 180, margin: "0 auto 12px", background: error ? "rgba(239,83,80,0.08)" : "rgba(0,0,0,0.4)", border: `1px solid ${error ? C.red : C.border2}`, borderRadius: 8, padding: "12px 16px", textAlign: "center", fontFamily: MONO, fontSize: 20, color: C.text, outline: "none", letterSpacing: "0.3em", transition: "all 0.2s" }} />
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "0 0 12px" }}>incorrect</p>}
        <Btn onClick={check} disabled={pin.length < 1} color={C.green}>Unlock</Btn>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}} *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.8}`}</style>
    </div>
  );
}

// --- LOGIN SCREEN -------------------------------------------------------------
function LoginScreen({ onEnter, onPrepReady }) {
  const [brief,      setBrief]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [prepStatus, setPrepStatus] = useState("running");
  const [weekLog,    setWeekLog]    = useState({ dms: 0, emails: 0, today: { dms: 0, emails: 0 } });

  const now       = new Date();
  const hour      = now.getHours();
  const greet     = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayStr    = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isWeekend = [0, 6].includes(now.getDay());
  const techTopic = TECH_TOPICS[now.getDay() % TECH_TOPICS.length];

  useEffect(() => {
    ensureAnalyticsLoaded().then(() => {
      setWeekLog(getWeekLog());
      const todayNiche = pickTodayNiche();

      const briefP = ai(
        RWS_CTX + `\n\nGenerate a daily briefing. Return ONLY valid JSON, no backticks, no markdown:
{"synopsis":"2-3 sentences. Mention today is ${dayStr}. Weekend means no day job constraints.","focus":"Single highest-leverage RWS task today - be specific and actionable.","tech":"2 sentences specifically about: ${techTopic}. Name actual products, tools, or companies. Make it feel like a real headline, not a textbook definition.","motivation":"One grounded punchy sentence. No quotes. Not cheesy. Not generic."}`,
        `Today: ${dayStr}. Weekend: ${isWeekend}. Hour: ${hour}. Tech topic for today: ${techTopic}.`
      ).then(raw => {
        try { setBrief(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setBrief({ synopsis: `It's ${dayStr}.`, focus: "Follow up with warm leads.", tech: "Check out the latest in " + techTopic + ".", motivation: "Ship something today." }); }
        setLoading(false);
      });

      const prepP = (async () => {
        try {
          markNicheUsed(todayNiche);
          const data         = await fetchLeads(todayNiche.query, todayNiche.location);
          logNicheSearch(todayKey(), todayNiche, data.aGrade || 0, data.bGrade || 0);
          const allResults   = data.prospects || [];
          const candidates   = allResults.filter(p => p.grade === "A" || p.grade === "B").slice(0, 8);
          const rest         = allResults.filter(p => p.grade !== "A" && p.grade !== "B").slice(0, 4);

          const enrichedCandidates = await Promise.all(
            candidates.map(async p => {
              const enrichment = await enrichLead(p);
              return { ...p, ...enrichment, enriched: true };
            })
          );

          const existingPipeline = await loadPipeline();
          const existingNames    = new Set(existingPipeline.map(l => l.name));
          const dismissed        = await loadDismissed();

          const toAdd = enrichedCandidates.filter(p =>
            !!(p.email || p.instagram) && !existingNames.has(p.name) && !dismissed.has(p.name)
          );

          let updatedPipeline = existingPipeline;
          if (toAdd.length > 0) {
            const newEntries = toAdd.map(p => ({
              id: `${Date.now()}-${Math.random()}`, status: "new", notes: "",
              addedAt: new Date().toISOString(), contactedAt: null, ...p,
            }));
            updatedPipeline = [...existingPipeline, ...newEntries];
            await savePipeline(updatedPipeline);
          }

          const allProspects = [...enrichedCandidates, ...rest];
          onPrepReady({
            prospects: allProspects,
            niche: `${todayNiche.query} — ${todayNiche.location}`,
            autoPipelined: toAdd.length,
            pipeline: updatedPipeline,
          });
        } catch (e) { console.error("prep error", e); }
        setPrepStatus("done");
      })();

      Promise.all([briefP, prepP]);
    });
  }, []);

  const card = (delay, content) => (
    <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "20px 24px", animation: "fadeUp 0.5s ease both", animationDelay: delay, opacity: 0 }}>
      {content}
    </div>
  );

  const todayNicheDisplay = (() => {
    const n = pickTodayNiche();
    return `${n.query} — ${n.location}`;
  })();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", backgroundImage: `radial-gradient(ellipse 55% 45% at 50% -5%, rgba(0,230,118,0.06) 0%, transparent 60%)` }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.4s ease both", opacity: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 10px" }}>Rogers Web Solutions  Anaheim, CA</p>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px,5vw,46px)", fontWeight: 700, color: C.white, margin: "0 0 6px" }}>{greet}, Trafton.</h1>
        <p style={{ fontFamily: BODY, fontSize: 14, color: C.sub, margin: 0 }}>{dayStr}</p>
      </div>

      <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {card("0.12s", <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>Day Synopsis</Label>
            <Pill color={loading ? C.amber : C.green}>{loading ? "loading" : "ready"}</Pill>
          </div>
          {loading
            ? <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, animation: "blink 0.9s step-start infinite" }}>generating...</span>
            : <>
                <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.75, color: C.sub, margin: "0 0 12px" }}>{brief?.synopsis}</p>
                {brief?.focus && <div style={{ padding: "9px 13px", background: `${C.green}08`, borderRadius: 8, border: `1px solid ${C.green}20` }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.1em" }}>FOCUS  </span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: C.text }}>{brief.focus}</span>
                </div>}
              </>
          }
        </>)}
        {card("0.18s", (() => {
          const todayTotal = weekLog.today.dms + weekLog.today.emails;
          const weekTotal  = weekLog.dms + weekLog.emails;
          const goal       = 5;
          const pct        = Math.min(100, Math.round((todayTotal / goal) * 100));
          const statusColor = todayTotal >= goal ? C.green : todayTotal > 0 ? C.amber : C.muted;
          const statusLabel = todayTotal >= goal ? "Goal hit" : todayTotal > 0 ? "In progress" : "Not started";
          return <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Label>Outreach Today</Label>
              <Pill color={statusColor} sm>{statusLabel}</Pill>
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
              {[{ val: weekLog.today.dms, label: "DMs today", color: C.purple }, { val: weekLog.today.emails, label: "Emails today", color: C.green }, { val: weekTotal, label: "This week", color: C.blue }].map(s => (
                <div key={s.label}>
                  <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: s.color }}>{s.val}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: 6 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: statusColor, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, flexShrink: 0 }}>{todayTotal}/{goal}</span>
            </div>
          </>;
        })())}
        {card("0.24s", <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Label>Tech Pulse</Label>
            {!loading && <Pill color={C.blue} sm>{techTopic.split(",")[0].trim()}</Pill>}
          </div>
          {loading
            ? <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, animation: "blink 0.9s step-start infinite" }}>scanning...</span>
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
              <Label>Today's Leads</Label>
              <p style={{ fontFamily: BODY, fontSize: 13, color: C.sub, margin: 0 }}>
                {prepStatus === "running" ? `Pulling + enriching: ${todayNicheDisplay}` : "Leads enriched and auto-pipelined"}
              </p>
            </div>
            <Pill color={prepStatus === "done" ? C.green : C.amber}>{prepStatus === "done" ? "ready" : "working"}</Pill>
          </div>
        )}
      </div>

      <button onClick={onEnter} style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "14px 44px", borderRadius: 50, cursor: "pointer", background: `${C.green}14`, border: `1px solid ${C.green}55`, color: C.green, transition: "all 0.2s", animation: "fadeUp 0.5s ease both", animationDelay: "0.5s", opacity: 0 }}>
        {prepStatus === "done" ? "Enter - Leads Ready" : "Enter Command Center"}
      </button>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)}100%{box-shadow:0 0 0 12px rgba(0,230,118,0)}}
        *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.8;transform:translateY(-1px)}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
      `}</style>
    </div>
  );
}

// --- EDIT PANEL ---------------------------------------------------------------
function EditPanel({ data, onChange, onSave, onCancel }) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "rgba(171,71,188,0.04)" }}>
      <Label>Edit Lead Data</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { key: "email", label: "Email", placeholder: "owner@business.com" },
          { key: "instagramHandle", label: "IG Handle", placeholder: "@handle" },
          { key: "website", label: "Website URL", placeholder: "https://..." },
        ].map(f => (
          <div key={f.key}>
            <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</p>
            <input value={data[f.key] || ""} onChange={e => {
              if (f.key === "instagramHandle") {
                const raw = e.target.value.replace(/^@/, "");
                onChange(d => ({ ...d, instagramHandle: raw ? `@${raw}` : "", instagram: raw ? `https://www.instagram.com/${raw}/` : "" }));
              } else {
                onChange(d => ({ ...d, [f.key]: e.target.value }));
              }
            }} placeholder={f.placeholder}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }} />
          </div>
        ))}
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Website Type</p>
          <select value={data.websiteType || ""} onChange={e => onChange(d => ({ ...d, websiteType: e.target.value, hasWebsite: e.target.value !== "none" && e.target.value !== "" }))}
            style={{ width: "100%", boxSizing: "border-box", background: "#0d0f14", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }}>
            <option value="">None / Unknown</option>
            <option value="none">No website</option>
            <option value="link_in_bio">Link-in-bio</option>
            <option value="real">Real website</option>
            <option value="weak">Weak DIY site (Wix, GoDaddy, etc)</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Notes</p>
        <textarea value={data.notes || ""} onChange={e => onChange(d => ({ ...d, notes: e.target.value }))} rows={2}
          placeholder="e.g. Active on IG, no real site, owner name is Maria"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none", resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onSave} color={C.green} sm>Save Changes</Btn>
        <Btn onClick={onCancel} color={C.muted} sm>Cancel</Btn>
      </div>
    </div>
  );
}

// --- COPY PANEL ---------------------------------------------------------------
// onChannel(channel) fires when DM is copied or email is sent — used by Pipeline
// cards to stamp lastChannel on the lead for channel-performance analytics.
function CopyPanel({ prospect, onSend, onChannel, copyType = null, autoGenerate = false }) {
  const [draft,      setDraft]      = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState(null);
  const [sending,    setSending]    = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSend,   setShowSend]   = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  useEffect(() => {
    setDraft(null); setExpanded(false); setGenError(null);
  }, [prospect.name, prospect.email, prospect.instagram, prospect.websiteType, prospect.website, prospect.hasWebsite, prospect.notes]);

  useEffect(() => {
    if (autoGenerate) generateCopy();
  }, []);

  async function generateCopy() {
    if (draft) { setExpanded(e => !e); return; }
    setGenerating(true); setGenError(null);

    const wType      = prospect.websiteType;
    const wUrl       = prospect.website;
    const websiteCtx =
      wType === "link_in_bio" ? `Has a link-in-bio page (${wUrl}) - no standalone website`
      : wType === "weak"      ? `Has a DIY website (${wUrl})`
      : wType === "real"      ? `Has a real website: ${wUrl}`
      : wUrl                  ? `Has website: ${wUrl}`
      : "No website";

    const contactInfo = [
      prospect.email     ? `Email: ${prospect.email}` : null,
      prospect.instagram ? `Instagram: ${prospect.instagram} (${prospect.instagramHandle})` : null,
      prospect.phone     ? `Phone: ${prospect.phone}` : null,
    ].filter(Boolean).join(" | ");

    const type = copyType || "cold";

    // For follow-ups, pass prior cold message so model avoids parroting it.
    // priorDm / priorEmail are stamped on the lead when the cold version is copied/sent.
    const priorDm    = prospect.priorDm    || null;
    const priorEmail = prospect.priorEmail || null;
    const hasPriorContext = type !== "cold" && (priorDm || priorEmail);

    const typeInstructions =
      type === "secondbump"
        ? `Write a SECOND follow-up IG DM and SECOND follow-up email. Third and final contact.

ABSOLUTE RULES — violating any of these makes this read as automated/AI/spam:
- DM is ONE sentence only. The door left open + the booking link. That is the entire message.
- Email body is 2 sentences max.
- DO NOT restate the rating, review count, location, or category. Those data points were already used in the cold message.
- DO NOT repeat the original pitch sentence ("I build websites for..." / "We build...").
- DO NOT explain what a website would do for them. No value proposition. No "easier booking", no "showcase", no "help you grow".
- DO NOT introduce any new observation. This is a closer, not a re-engagement.
- Use phrasing like "last note from me" or "this is the last one" — it removes pressure and gets disproportionate replies.
- No urgency. No guilt. No "I get it, you're busy" (that's condescending).`
        : type === "followup"
          ? `Write a FIRST follow-up IG DM and first follow-up email. They did not respond to cold outreach.

ABSOLUTE RULES — violating any of these makes this read as a mass blast:
- DO NOT restate the rating, review count, location, or category. Those data points were already used in the cold message. Recipients notice repeat data IMMEDIATELY and it's the #1 signal of automation.
- DO NOT repeat the original pitch sentence verbatim or near-verbatim. The cold message already said "I build websites for [niche] in OC" or equivalent. Do not say that again.
- DO NOT explain why a website would help them. No value proposition. No "make booking easier", no "showcase services", no "help you grow", no "more clients", no "online presence".
- DO NOT use phrases like "if you're interested in exploring", "might look like", "basic", "simple" — these are corporate hedge language.
- Lead with acknowledgment that the message may have been buried/missed. Plain and direct.
- You MAY add ONE new factual detail about the OFFER (timeline like "builds usually go live in about a week", what's included like "Google Business Profile setup included", payment terms). NOT a benefit. A FACT.
- Or skip the new detail entirely and just bump with the link. A 2-sentence "wanted to follow up here in case it got buried, link's still open if useful: rogers-websolutions.com/book" is GOOD copy, not lazy copy.
- DM is 2 sentences MAX. Email body is 2-3 short paragraphs MAX.`
          : `Write a cold IG DM and cold email for this REAL business. DM rules: 3 sentences MAX. Sentence 1: one specific observation about this business using real data only (rating, review count, category). Sentence 2: open a door — one plain sentence about what RWS does, no problem framing, no gap lecture, no "which means", no pain amplification, no competitor mention. Sentence 3: soft ask with rogers-websolutions.com/book. Cold email: 3-4 short paragraphs. Same rules — observation first, door open second, soft ask close. Do not use "online presence", "digital footprint", "missing out", "losing", "falling behind", or any urgency language.`;

    const priorContextBlock = hasPriorContext
      ? `\n\nPRIOR COLD MESSAGES ALREADY SENT TO THIS LEAD (do NOT parrot phrasing, observations, or pitch sentences from these — the recipient saw them already):${priorDm ? `\n--- PRIOR DM ---\n${priorDm}` : ""}${priorEmail ? `\n--- PRIOR EMAIL ---\n${priorEmail}` : ""}\n--- END PRIOR ---\n\nYour follow-up must read like a HUMAN bump from someone who already sent the above and is just nudging once more. Do not re-introduce yourself. Do not restate the data points. Do not repeat the pitch.`
      : "";

    const emailLabel = type === "secondbump" ? "Second follow-up" : type === "followup" ? "Follow-up" : "Cold";
    const dmLength   = type === "secondbump" ? "1 sentence ONLY" : type === "followup" ? "1-2 sentences MAX" : "3 sentences MAX";

    try {
      const raw = await ai(
        RWS_CTX + `\n\n${typeInstructions}${priorContextBlock}\n\nReturn ONLY valid JSON, no backticks:
{"dm":"${dmLength}. ${type === "cold" ? "Observation first. Open a door second — what RWS does, no problem framing. Soft ask third. No competitor framing. No pain lecture." : "Do NOT re-introduce yourself or repeat the cold pitch. Do NOT restate rating/reviews/location. No pain points. No value framing."} Close with rogers-websolutions.com/book. Final line must be exactly: Trafton @ Rogers Web Solutions","emailSubject":"${type !== "cold" ? "Subject that signals follow-up without being passive aggressive. Examples: 'Following up — [business name]' or 'One more from me — [business name]'. Do NOT reuse the cold email subject line." : "Subject line using one specific real data point about the business — not generic"}","emailBody":"${emailLabel} email. ${type === "secondbump" ? "Very short — 2 sentences max. No re-pitch. No restated data points." : "2-3 short paragraphs. No urgency language. No competitor framing. No restated data points. No repeated pitch sentence."} Close: rogers-websolutions.com/book. Final line must be exactly: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com"}`,
        `Business: ${prospect.name} | City: ${prospect.city} | Category: ${prospect.category} | Rating: ${prospect.rating}* | Reviews: ${prospect.reviews} | ${websiteCtx} | ${contactInfo}${prospect.notes ? ` | Context: ${prospect.notes}` : ""}`
      );
      if (raw.startsWith("Error:")) { setGenError(raw); }
      else {
        try { setDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setDraft({ dm: raw, emailSubject: `${prospect.name} — follow up`, emailBody: raw }); }
        setExpanded(true);
      }
    } catch (e) { setGenError(`Error: ${e.message}`); }
    setGenerating(false);
  }

  // copyType determines what gets stamped onto the lead:
  // - "cold" → stamp priorDm/priorEmail (so future follow-ups can avoid parroting)
  // - "followup" / "secondbump" → don't overwrite the cold message; that's the
  //   reference text future generations should still avoid copying
  const isColdGeneration = !copyType || copyType === "cold";

  async function handleSend() {
    if (!prospect.email || !draft) return;
    setSending(true); setSendResult(null);
    const result = await sendEmail(prospect.email, draft.emailSubject, draft.emailBody);
    setSending(false);
    if (result.success) {
      setSendResult("sent");
      logOutreach("emails");
      if (onChannel) {
        onChannel("email", isColdGeneration ? `Subject: ${draft.emailSubject}\n\n${draft.emailBody}` : null);
      }
      if (onSend) onSend();
    }
    else { setSendResult(result.error || "unknown error"); }
  }

  function handleDmCopy() {
    logOutreach("dms");
    if (onChannel) {
      onChannel("dm", isColdGeneration ? draft?.dm : null);
    }
  }

  function handleEmailCopy() {
    if (onChannel && isColdGeneration && draft) {
      onChannel("email", `Subject: ${draft.emailSubject}\n\n${draft.emailBody}`);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: expanded && draft ? 14 : 0 }}>
        <Btn onClick={() => generateCopy()} loading={generating} color={C.amber} sm>
          {draft ? (expanded ? "Hide Copy" : "Show Copy") : "Get Copy"}
        </Btn>
        {genError && <Btn onClick={() => { setGenError(null); generateCopy(); }} color={C.red} sm>Retry</Btn>}
      </div>
      {genError && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.red }}>{genError} — hit Retry</span>
        </div>
      )}
      {expanded && draft && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>IG DM</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={draft.dm} label="Copy DM" sm onCopy={handleDmCopy} />
                {prospect.instagram && (
                  <a href={prospect.instagram} target="_blank" rel="noreferrer"
                    style={{ fontFamily: MONO, fontSize: 10, color: C.purple, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.purple}45`, textDecoration: "none", background: `${C.purple}12` }}>
                    Open IG
                  </a>
                )}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.dm}</div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Email</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CopyBtn text={`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`} label="Copy" sm onCopy={handleEmailCopy} />
                {prospect.email
                  ? <Btn onClick={() => setShowSend(f => !f)} color={C.green} sm>{showSend ? "Cancel" : "Send via Gmail"}</Btn>
                  : <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Add email in Edit to send</span>
                }
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {draft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.emailBody}</div>
            {showSend && prospect.email && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${C.green}08`, borderRadius: 8, border: `1px solid ${C.green}20`, marginBottom: 8 }}>
                  <Dot color={C.green} size={5} />
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>To: {prospect.email}</span>
                </div>
                <Btn onClick={handleSend} loading={sending} color={C.green}>Send from trogers@rogers-websolutions.com</Btn>
              </div>
            )}
            {sendResult === "sent" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.green, margin: "8px 0 0" }}>Sent</p>}
            {sendResult && sendResult !== "sent" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "8px 0 0" }}>Send failed: {sendResult}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// --- LEAD GRID CARD -----------------------------------------------------------
function LeadGridCard({ prospect: initialProspect, onAdd, inPipeline, onDismiss, isSelected, onSelect }) {
  const [prospect,  setProspect]  = useState(initialProspect);
  const [enriching, setEnriching] = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [editData,  setEditData]  = useState({
    email: prospect.email || "", instagram: prospect.instagram || "",
    instagramHandle: prospect.instagramHandle || "", website: prospect.website || "",
    hasWebsite: prospect.hasWebsite ?? false, websiteType: prospect.websiteType || "", notes: prospect.notes || "",
  });

  const gc         = GRADE_COLOR[prospect.grade] || C.muted;
  const isEnriched = !!(prospect.email || prospect.instagram);

  async function handleEnrich() {
    setEnriching(true);
    try {
      const result = await enrichLead(prospect);
      if (result && !result.error) {
        const patch = { email: result.email || prospect.email || null, instagram: result.instagram || prospect.instagram || null, instagramHandle: result.instagramHandle || prospect.instagramHandle || null, websiteType: result.websiteType || prospect.websiteType || null, enriched: true };
        setProspect(p => ({ ...p, ...patch }));
        setEditData(d => ({ ...d, email: patch.email || d.email, instagram: patch.instagram || d.instagram, instagramHandle: patch.instagramHandle || d.instagramHandle, websiteType: patch.websiteType || d.websiteType }));
      }
    } catch (e) { console.error("Enrich failed:", e); }
    setEnriching(false);
  }

  function saveEdit() {
    setProspect(p => ({ ...p, email: editData.email.trim() || null, instagram: editData.instagram.trim() || null, instagramHandle: editData.instagramHandle.trim() || null, website: editData.website.trim() || null, hasWebsite: editData.hasWebsite, websiteType: editData.websiteType, notes: editData.notes.trim(), enriched: !!(editData.email || editData.instagram), manuallyEdited: true }));
    setEditing(false);
  }

  const liveLead = { ...prospect, email: editData.email.trim() || prospect.email || null, instagram: editData.instagram.trim() || prospect.instagram || null, instagramHandle: editData.instagramHandle.trim() || prospect.instagramHandle || null, notes: editData.notes.trim() || prospect.notes || null };

  return (
    <div
      onClick={() => !editing && onSelect()}
      style={{ background: C.cardHi, border: `1px solid ${isSelected ? "rgba(255,255,255,0.2)" : C.border}`, borderRadius: 8, overflow: "hidden", cursor: editing ? "default" : "pointer", transition: "border-color 0.12s" }}
    >
      <div style={{ padding: "11px 13px" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
          <Pill color={gc} sm>Grade {prospect.grade}</Pill>
          {prospect.websiteType === "link_in_bio" && <Pill color={C.amber} sm>Link-in-bio</Pill>}
          {!prospect.hasWebsite && prospect.websiteType !== "link_in_bio" && <Pill color={C.green} sm>No site</Pill>}
          {isEnriched && <Pill color={C.blue} sm>Enriched</Pill>}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prospect.name}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prospect.address || prospect.city}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {prospect.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>★ {prospect.rating} ({prospect.reviews})</span>}
          {prospect.phone && <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{prospect.phone}</span>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: gc, marginTop: 4, lineHeight: 1.4 }}>{prospect.gradeReason}</div>
      </div>

      {isSelected && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: "10px 13px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            {prospect.email && <span style={{ fontFamily: MONO, fontSize: 10, color: C.green }}>{prospect.email}</span>}
            {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, textDecoration: "none" }}>{prospect.instagramHandle || "Instagram"}</a>}
            {prospect.mapsUrl && <a href={prospect.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.blue, textDecoration: "none" }}>Maps</a>}
            {prospect.website && <a href={prospect.website} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.sub, textDecoration: "none" }}>{prospect.websiteType === "link_in_bio" ? "Link-in-bio" : "Website"}</a>}
            {!prospect.email && !prospect.instagram && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>No contact found — hit Enrich</span>}
          </div>
          <div style={{ padding: "10px 13px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn onClick={() => onAdd(prospect)} disabled={inPipeline} color={inPipeline ? C.purple : C.green} sm>{inPipeline ? "In Pipeline" : "+ Pipeline"}</Btn>
            <Btn onClick={handleEnrich} loading={enriching} color={C.blue} sm>{isEnriched ? "Re-enrich" : "Enrich"}</Btn>
            <Btn onClick={() => setEditing(e => !e)} color={C.purple} sm>{editing ? "Cancel Edit" : "Edit"}</Btn>
            <Btn onClick={() => onDismiss(prospect.name)} color={C.red} sm>Not a Fit</Btn>
          </div>
          {editing && <EditPanel data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditing(false)} />}
          {!editing && <CopyPanel prospect={liveLead} onSend={() => {}} />}
        </div>
      )}
    </div>
  );
}

// --- LEAD GRADE GROUP --------------------------------------------------------
function LeadGradeGroup({ grade, label, color, items, onAdd, pipelineNames, onDismiss, defaultOpen }) {
  const [selectedName, setSelectedName] = useState(null);
  function handleSelect(name) { setSelectedName(prev => prev === name ? null : name); }

  return (
    <Section title={label} color={color} count={items.length} defaultOpen={defaultOpen}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
        {items.map((p, i) => (
          <LeadGridCard
            key={`${p.name}-${i}`}
            prospect={p}
            onAdd={onAdd}
            inPipeline={pipelineNames.has(p.name)}
            onDismiss={onDismiss}
            isSelected={selectedName === p.name}
            onSelect={() => handleSelect(p.name)}
          />
        ))}
      </div>
    </Section>
  );
}

// --- LEAD SCRAPER -------------------------------------------------------------
function LeadScraper({ state, setState, onAdd, pipelineNames }) {
  const { niche = "", location = "Orange County, California", prospects = [], loading = false, error = "" } = state;
  const [dismissed,      setDismissed]      = useState(new Set());
  const [autoPipelining, setAutoPipelining] = useState(false);
  const [autoLog,        setAutoLog]        = useState([]);
  const [showAutoLog,    setShowAutoLog]    = useState(false);
  const [nichesOpen,     setNichesOpen]     = useState(false);

  useEffect(() => { loadDismissed().then(setDismissed); }, []);

  function fillNiche(n) {
    setState(s => ({ ...s, niche: n.query, location: n.location }));
  }

  async function search() {
    if (!niche.trim()) return;
    setState(s => ({ ...s, loading: true, error: "" }));
    const searchLocation = location.trim() || "Orange County, California";
    const data = await fetchLeads(niche, searchLocation);
    if (data.error) { setState(s => ({ ...s, loading: false, error: data.error })); return; }
    logNicheSearch(todayKey(), { query: niche, location: searchLocation }, data.aGrade || 0, data.bGrade || 0);
    const newProspects = data.prospects || [];
    setState(s => {
      const existingNames = new Set((s.prospects || []).map(p => p.name));
      return { ...s, loading: false, prospects: [...(s.prospects || []), ...newProspects.filter(p => !existingNames.has(p.name))], lastSearch: niche };
    });

    const candidates = newProspects.filter(p => (p.grade === "A" || p.grade === "B") && !pipelineNames.has(p.name));
    if (!candidates.length) return;
    const currentDismissed = await loadDismissed();
    const eligible = candidates.filter(p => !currentDismissed.has(p.name));
    if (!eligible.length) return;

    setAutoLog([`Auto-enriching ${eligible.length} Grade A/B leads...`]); setShowAutoLog(true); setAutoPipelining(true);
    const log = [`Auto-enriching ${eligible.length} Grade A/B leads...`];
    let added = 0, skipped = 0;
    for (const prospect of eligible) {
      log.push(`Enriching ${prospect.name}...`); setAutoLog([...log]);
      const result   = await enrichLead(prospect);
      const enriched = { ...prospect, ...result, enriched: true };
      if (!!(enriched.email || enriched.instagram)) { onAdd(enriched); added++; log.push(`Added: ${prospect.name}`); }
      else { skipped++; log.push(`Skipped: ${prospect.name} - no contact`); }
      setAutoLog([...log]);
    }
    log.push(`Done. ${added} added, ${skipped} skipped.`); setAutoLog([...log]); setAutoPipelining(false);
  }

  async function autoPipeline() {
    const visible    = prospects.filter(p => !dismissed.has(p.name) && !pipelineNames.has(p.name));
    const candidates = visible.filter(p => p.grade === "A" || p.grade === "B");
    if (!candidates.length) { setAutoLog(["No Grade A/B leads available."]); setShowAutoLog(true); return; }
    setAutoPipelining(true); setAutoLog([`Found ${candidates.length} candidates. Enriching...`]); setShowAutoLog(true);
    let added = 0, skipped = 0;
    const log = [`Found ${candidates.length} candidates. Enriching...`];
    for (const prospect of candidates) {
      log.push(`Enriching ${prospect.name}...`); setAutoLog([...log]);
      const result   = await enrichLead(prospect);
      const enriched = { ...prospect, ...result, enriched: true };
      if (!!(enriched.email || enriched.instagram)) { onAdd(enriched); added++; log.push(`Added: ${prospect.name}`); }
      else { skipped++; log.push(`Skipped: ${prospect.name} - no contact`); }
      setAutoLog([...log]);
    }
    log.push(`Done. ${added} added, ${skipped} skipped.`); setAutoLog([...log]); setAutoPipelining(false);
  }

  function handleDismiss(name) {
    setDismissed(prev => new Set([...prev, name]));
    dismissLead(name);
    setState(s => ({ ...s, prospects: s.prospects.filter(p => p.name !== name) }));
  }

  const visible  = prospects.filter(p => !dismissed.has(p.name) && !pipelineNames.has(p.name));
  const aGrade   = visible.filter(p => p.grade === "A");
  const bGrade   = visible.filter(p => p.grade === "B");
  const cGrade   = visible.filter(p => p.grade === "C");
  const dGrade   = visible.filter(p => p.grade === "D");
  const noSite   = visible.filter(p => !p.hasWebsite);
  const autoCandidates = visible.filter(p => (p.grade === "A" || p.grade === "B") && !pipelineNames.has(p.name)).length;

  const gradeGroups = [
    { grade: "A", label: "Grade A — Perfect fit",          color: C.green, items: aGrade, defaultOpen: true  },
    { grade: "B", label: "Grade B — Solid prospect",       color: C.amber, items: bGrade, defaultOpen: true  },
    { grade: "C", label: "Grade C — Redesign / care plan", color: C.blue,  items: cGrade, defaultOpen: false },
    { grade: "D", label: "Grade D — Has website",          color: C.muted, items: dGrade, defaultOpen: false },
  ].filter(g => g.items.length > 0);

  const highPriorityNiches = NICHES.filter(n => n.priority === "high");
  const medPriorityNiches  = NICHES.filter(n => n.priority === "medium");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setNichesOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: nichesOpen ? 12 : 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>Priority targets</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, transform: nichesOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
          </button>
          {nichesOpen && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Pill color={C.green} sm>High</Pill>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {highPriorityNiches.map((n, i) => (
                  <button key={i} onClick={() => fillNiche(n)}
                    style={{ fontFamily: MONO, fontSize: 9, padding: "3px 10px", borderRadius: 20, cursor: "pointer", background: (niche === n.query && location === n.location) ? `${C.green}18` : "rgba(255,255,255,0.03)", border: `1px solid ${(niche === n.query && location === n.location) ? C.green : C.border}`, color: (niche === n.query && location === n.location) ? C.green : C.sub }}>
                    {n.query} — {n.location}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Pill color={C.amber} sm>Medium</Pill>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {medPriorityNiches.map((n, i) => (
                  <button key={i} onClick={() => fillNiche(n)}
                    style={{ fontFamily: MONO, fontSize: 9, padding: "3px 10px", borderRadius: 20, cursor: "pointer", background: (niche === n.query && location === n.location) ? `${C.amber}18` : "rgba(255,255,255,0.03)", border: `1px solid ${(niche === n.query && location === n.location) ? C.amber : C.border}`, color: (niche === n.query && location === n.location) ? C.amber : C.sub }}>
                    {n.query} — {n.location}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 2 }}>
            <Field value={niche} onChange={v => setState(s => ({ ...s, niche: v }))} placeholder="nail salons, handyman, motels..." onKeyDown={e => e.key === "Enter" && search()} />
          </div>
          <div style={{ flex: 1 }}>
            <Field value={location} onChange={v => setState(s => ({ ...s, location: v }))} placeholder="Westminster, CA" onKeyDown={e => e.key === "Enter" && search()} />
          </div>
          <Btn onClick={search} loading={loading} disabled={!niche.trim()} color={C.amber}>Search</Btn>
        </div>

        {prospects.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button onClick={() => setState(s => ({ ...s, prospects: [] }))} style={{ fontFamily: MONO, fontSize: 10, background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>Clear results</button>
            {autoCandidates > 0 && <Btn onClick={autoPipeline} loading={autoPipelining} color={C.green} sm>Auto-enrich &amp; pipeline ({autoCandidates} A/B)</Btn>}
          </div>
        )}
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "10px 0 0" }}>Error: {error}</p>}
      </div>

      {showAutoLog && autoLog.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>Auto-pipeline log</Label>
            {!autoPipelining && <button onClick={() => setShowAutoLog(false)} style={{ fontFamily: MONO, fontSize: 10, background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>Dismiss</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {autoLog.map((line, i) => {
              const isAdded = line.startsWith("Added:"), isSkipped = line.startsWith("Skipped:"), isDone = line.startsWith("Done.");
              const color   = isAdded ? C.green : isSkipped ? C.muted : isDone ? C.amber : C.sub;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {autoPipelining && i === autoLog.length - 1 && !isDone
                    ? <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, animation: "blink 0.9s step-start infinite" }}>{">"}</span>
                    : <span style={{ fontFamily: MONO, fontSize: 10, color, flexShrink: 0 }}>{isAdded ? "+" : isSkipped ? "-" : isDone ? "—" : ""}</span>}
                  <span style={{ fontFamily: MONO, fontSize: 11, color }}>{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontFamily: MONO, fontSize: 12, color: C.muted, margin: 0 }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Pulling businesses from Google Maps...</span></p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {[{ label: "Total", val: visible.length, color: C.sub }, { label: "No Site", val: noSite.length, color: C.green }, { label: "Grade A", val: aGrade.length, color: C.green }, { label: "Grade B", val: bGrade.length, color: C.amber }, { label: "Grade C", val: cGrade.length, color: C.blue }].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: s.color, marginBottom: 2 }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gradeGroups.map(g => (
              <LeadGradeGroup
                key={g.grade}
                grade={g.grade}
                label={g.label}
                color={g.color}
                items={g.items}
                onAdd={onAdd}
                pipelineNames={pipelineNames}
                onDismiss={handleDismiss}
                defaultOpen={g.defaultOpen}
              />
            ))}
          </div>
        </>
      )}

      {!loading && visible.length === 0 && prospects.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>All results dismissed or in pipeline.</p>
        </div>
      )}
      {!loading && prospects.length === 0 && niche && !error && (
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "16px 20px" }}>
          <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>Hit Search to pull real businesses from Google Maps.</p>
        </div>
      )}
    </div>
  );
}

// --- OUTREACH MODULE ----------------------------------------------------------
function OutreachModule({ state, setState, pipeline }) {
  const { selected = null, type = "cold", output = "", loading = false, custom = "" } = state;
  const types = [
    { id: "cold", label: "Cold Email" }, { id: "dm", label: "IG DM" },
    { id: "followup", label: "Follow-up" }, { id: "warm", label: "Warm Close" },
  ];

  async function generate() {
    const target = selected
      ? `Business: ${selected.name} | City: ${selected.city} | Rating: ${selected.rating} stars | Reviews: ${selected.reviews} | Has website: ${selected.hasWebsite}${selected.email ? ` | Email: ${selected.email}` : ""}${selected.instagram ? ` | Instagram: ${selected.instagram}` : ""}`
      : custom;
    if (!target.trim()) return;
    setState(s => ({ ...s, loading: true, output: "" }));
    const prompts = {
      cold:     "Write a cold outreach EMAIL with Subject: line. Open with one specific observation about this business using real data. State the practical gap plainly — no competitor framing, no urgency, no 'which means', no pain amplification. 3-4 short paragraphs. Soft close with rogers-websolutions.com/book. Final line: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com",
      dm:       "Write a cold Instagram DM. 3 sentences MAX. Sentence 1: specific observation using real data. Sentence 2: plain gap statement, no lecturing. Sentence 3: soft ask with rogers-websolutions.com/book. Final line: Trafton @ Rogers Web Solutions",
      followup: "Write a follow-up email. 1-2 short paragraphs. Different angle from cold outreach. No re-pitch, no pain points, no urgency. Final line: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com",
      warm:     "Write a closing email to a warm lead. Confident, short, direct path to booking. Final line: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com",
    };
    const r = await ai(RWS_CTX + `\n\n${prompts[type]}`, target);
    setState(s => ({ ...s, output: r, loading: false }));
  }

  const activePipeline = pipeline.filter(l => ["new","contacted","followup","warm"].includes(l.status));
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.purple} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Outreach</span>
      </div>
      {activePipeline.length > 0 && (
        <>
          <Label>Pipeline Leads</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {activePipeline.map(l => (
              <button key={l.id} onClick={() => setState(s => ({ ...s, selected: l, custom: "", output: "" }))}
                style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: selected?.id === l.id ? `${C.purple}20` : "rgba(255,255,255,0.04)", border: `1px solid ${selected?.id === l.id ? C.purple : C.border}`, color: selected?.id === l.id ? C.purple : C.sub }}>
                {l.name}
              </button>
            ))}
          </div>
          <Divider />
        </>
      )}
      <Label>Or Describe a Lead</Label>
      <Field value={custom} onChange={v => setState(s => ({ ...s, custom: v, selected: null }))} placeholder="e.g. Electrician in Fullerton, 4.9 stars, 80 reviews, no website" rows={2} />
      <div style={{ marginTop: 14, marginBottom: 14 }}>
        <Label>Type</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {types.map(t => (
            <button key={t.id} onClick={() => setState(s => ({ ...s, type: t.id }))}
              style={{ fontFamily: MONO, fontSize: 10, padding: "6px 13px", borderRadius: 20, cursor: "pointer", background: type === t.id ? `${C.purple}18` : "transparent", border: `1px solid ${type === t.id ? C.purple : C.border}`, color: type === t.id ? C.purple : C.muted }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Btn onClick={generate} loading={loading} disabled={!selected && !custom.trim()} color={C.purple}>Generate {types.find(t => t.id === type)?.label}</Btn>
      {(loading || output) && (
        <div style={{ marginTop: 14 }}>
          <TextBox value={output} loading={loading} placeholder="" />
          {output && <div style={{ marginTop: 8 }}><CopyBtn text={output} sm /></div>}
        </div>
      )}
    </Card>
  );
}

// --- PIPELINE GRID CARD -------------------------------------------------------
function PipelineGridCard({ lead, onUpdate, onRemove, onStatusChange, isSelected, onSelect }) {
  const [editing,   setEditing]   = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [editData,  setEditData]  = useState({
    email: lead.email || "", instagram: lead.instagram || "", instagramHandle: lead.instagramHandle || "",
    website: lead.website || "", hasWebsite: lead.hasWebsite ?? false, websiteType: lead.websiteType || "", notes: lead.notes || "",
  });

  useEffect(() => {
    setEditData({ email: lead.email || "", instagram: lead.instagram || "", instagramHandle: lead.instagramHandle || "", website: lead.website || "", hasWebsite: lead.hasWebsite ?? false, websiteType: lead.websiteType || "", notes: lead.notes || "" });
  }, [lead.id]);

  const s        = STATUS[lead.status];
  const fu       = followUpStatus(lead);
  const gc       = GRADE_COLOR[lead.grade] || C.muted;
  const coldDays = daysCold(lead);
  const reEngage = isReEngageReady(lead);
  const liveLead = { ...lead, email: editData.email.trim() || lead.email || null, instagram: editData.instagram.trim() || lead.instagram || null, instagramHandle: editData.instagramHandle.trim() || lead.instagramHandle || null, notes: editData.notes.trim() || lead.notes || null, websiteType: editData.websiteType || lead.websiteType || null };

  async function handleEnrich() {
    setEnriching(true);
    try {
      const result = await enrichLead(lead);
      if (result && !result.error) {
        const patch = { email: result.email || lead.email || null, instagram: result.instagram || lead.instagram || null, instagramHandle: result.instagramHandle || lead.instagramHandle || null, websiteType: result.websiteType || lead.websiteType || null, enriched: true };
        onUpdate(lead.id, patch);
        setEditData(d => ({ ...d, email: patch.email || d.email, instagram: patch.instagram || d.instagram, instagramHandle: patch.instagramHandle || d.instagramHandle, websiteType: patch.websiteType || d.websiteType }));
      }
    } catch (e) { console.error("Enrich failed:", e); }
    setEnriching(false);
  }

  function saveEdit() {
    onUpdate(lead.id, { email: editData.email.trim() || null, instagram: editData.instagram.trim() || null, instagramHandle: editData.instagramHandle.trim() || null, website: editData.website.trim() || null, hasWebsite: editData.hasWebsite, websiteType: editData.websiteType, notes: editData.notes.trim(), enriched: !!(editData.email || editData.instagram), manuallyEdited: true });
    setEditing(false);
  }

  // Channel stamper — fires from CopyPanel when DM is copied or email is sent/copied.
  // For COLD generations, message is the cold draft text and gets stored on the lead
  // as priorDm / priorEmail so future follow-up generations can avoid parroting it.
  // For follow-up generations, message is null and we don't overwrite the cold capture.
  function handleChannel(channel, message) {
    const patch = { lastChannel: channel, lastOutreachAt: new Date().toISOString() };
    if (message) {
      if (channel === "dm")    patch.priorDm    = message;
      if (channel === "email") patch.priorEmail = message;
    }
    onUpdate(lead.id, patch);
  }

  return (
    <div
      onClick={() => !editing && onSelect()}
      style={{ background: C.card, border: `1px solid ${fu?.urgent ? C.amber + "50" : reEngage ? C.amber + "50" : isSelected ? "rgba(255,255,255,0.2)" : C.border2}`, borderRadius: 8, overflow: "hidden", cursor: editing ? "default" : "pointer", transition: "border-color 0.12s" }}
    >
      <div style={{ padding: "11px 13px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          {fu?.urgent && <Dot color={lead.status === "followup" ? C.red : C.amber} size={6} pulse />}
          {reEngage && <Dot color={C.amber} size={6} pulse />}
          <Pill color={s.color} sm>{s.label}</Pill>
          {lead.grade && <Pill color={gc} sm>{lead.grade}</Pill>}
          {lead.lastChannel && <Pill color={lead.lastChannel === "dm" ? C.purple : C.green} sm>{lead.lastChannel === "dm" ? "DM" : "Email"}</Pill>}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.name}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginBottom: 3 }}>{lead.city}</div>
        {lead.rating > 0 && <div style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>★ {lead.rating} ({lead.reviews})</div>}
        {fu && <div style={{ fontFamily: MONO, fontSize: 9, color: fu.color, marginTop: 3 }}>{fu.label}</div>}
        {coldDays !== null && !fu && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: reEngage ? C.amber : C.muted, marginTop: 3 }}>
            {reEngage ? `${coldDays}d cold — ready to re-engage` : `${coldDays}d cold`}
          </div>
        )}
        {lead.notes && <div style={{ fontFamily: MONO, fontSize: 9, color: C.sub, marginTop: 3, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.notes}</div>}
      </div>

      {isSelected && (
        <div onClick={e => e.stopPropagation()} style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: "9px 13px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            {lead.email && <span style={{ fontFamily: MONO, fontSize: 10, color: C.green }}>{lead.email}</span>}
            {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, textDecoration: "none" }}>{lead.instagramHandle || "Instagram"}</a>}
            {lead.phone && <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{lead.phone}</span>}
            {lead.mapsUrl && <a href={lead.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.blue, textDecoration: "none" }}>Maps</a>}
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Added {new Date(lead.addedAt).toLocaleDateString()}</span>
            {lead.lastOutreachAt && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Last touch {new Date(lead.lastOutreachAt).toLocaleDateString()} ({lead.lastChannel})</span>}
          </div>
          {/* Re-engage quick action */}
          {reEngage && (
            <div style={{ padding: "9px 13px", background: `${C.amber}06`, borderBottom: `1px solid ${C.border}` }}>
              <Btn onClick={() => onStatusChange(lead.id, "new")} color={C.amber} sm>Re-engage — move to New</Btn>
            </div>
          )}
          <div style={{ padding: "8px 13px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.border}` }}>
            {Object.entries(STATUS).map(([id, st]) => (
              <button key={id} onClick={() => onStatusChange(lead.id, id)}
                style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === id ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === id ? st.color : C.border}`, color: lead.status === id ? st.color : C.muted }}>
                {st.label}
              </button>
            ))}
          </div>
          <div style={{ padding: "8px 13px", display: "flex", gap: 5, flexWrap: "wrap", borderBottom: `1px solid ${C.border}` }}>
            <Btn onClick={handleEnrich} loading={enriching} color={C.blue} sm>{lead.enriched ? "Re-enrich" : "Enrich"}</Btn>
            <Btn onClick={() => setEditing(e => !e)} color={C.purple} sm>{editing ? "Cancel" : "Edit"}</Btn>
            <Btn onClick={() => onRemove(lead.id)} color={C.red} sm>Remove</Btn>
          </div>
          {editing && <EditPanel data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditing(false)} />}
          {!editing && <CopyPanel prospect={liveLead} onSend={() => onStatusChange(lead.id, "contacted")} onChannel={handleChannel} />}
        </div>
      )}
    </div>
  );
}

// --- PIPELINE GRID GROUP -----------------------------------------------------
function PipelineGridGroup({ title, color, leads, onUpdate, onRemove, onStatusChange, defaultOpen = false, urgentBorder = false }) {
  const [selectedId, setSelectedId] = useState(null);
  function handleSelect(id) { setSelectedId(prev => prev === id ? null : id); }
  if (leads.length === 0) return null;
  return (
    <Section title={title} color={color} count={leads.length} defaultOpen={defaultOpen} urgentBorder={urgentBorder}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
        {leads.map(l => (
          <PipelineGridCard
            key={l.id}
            lead={l}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onStatusChange={onStatusChange}
            isSelected={selectedId === l.id}
            onSelect={() => handleSelect(l.id)}
          />
        ))}
      </div>
    </Section>
  );
}

// --- ADD LEAD MODAL ----------------------------------------------------------
function AddLeadModal({ onAdd, onClose }) {
  const BLANK = { name: "", city: "", category: "", phone: "", email: "", instagramHandle: "", website: "", grade: "", notes: "" };
  const [form, setForm] = useState(BLANK);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function submit() {
    if (!form.name.trim()) return;
    const handle = form.instagramHandle.replace(/^@/, "");
    const lead = {
      id: `${Date.now()}-${Math.random()}`,
      status: "new",
      addedAt: new Date().toISOString(),
      contactedAt: null,
      manuallyAdded: true,
      name: form.name.trim(),
      city: form.city.trim(),
      category: form.category.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      instagramHandle: handle ? `@${handle}` : null,
      instagram: handle ? `https://www.instagram.com/${handle}/` : null,
      website: form.website.trim() || null,
      hasWebsite: !!(form.website.trim()),
      grade: form.grade || null,
      notes: form.notes.trim(),
      enriched: !!(form.email.trim() || handle),
    };
    onAdd(lead);
    onClose();
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 11px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 14, padding: "26px 28px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Add Lead Manually</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 13 }}>x</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { key: "name",            label: "Business Name *", placeholder: "ABC Plumbing Co." },
            { key: "city",            label: "City",            placeholder: "Anaheim" },
            { key: "category",        label: "Category",        placeholder: "HVAC, plumber..." },
            { key: "phone",           label: "Phone",           placeholder: "(714) 555-0100" },
            { key: "email",           label: "Email",           placeholder: "owner@biz.com" },
            { key: "instagramHandle", label: "Instagram Handle", placeholder: "@handle" },
          ].map(f => (
            <div key={f.key}>
              <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{f.label}</p>
              <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Website</p>
          <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Grade</p>
          <div style={{ display: "flex", gap: 6 }}>
            {["A","B","C","D"].map(g => (
              <button key={g} onClick={() => set("grade", form.grade === g ? "" : g)}
                style={{ fontFamily: MONO, fontSize: 11, padding: "5px 14px", borderRadius: 20, cursor: "pointer", background: form.grade === g ? `${GRADE_COLOR[g]}18` : "transparent", border: `1px solid ${form.grade === g ? GRADE_COLOR[g] : C.border}`, color: form.grade === g ? GRADE_COLOR[g] : C.muted }}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</p>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Context, referral source, anything relevant"
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={submit} disabled={!form.name.trim()} color={C.green}>Add to Pipeline</Btn>
          <Btn onClick={onClose} color={C.muted}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// --- PIPELINE MODULE ----------------------------------------------------------
function PipelineModule({ pipeline, onUpdate, onRemove, onAdd }) {
  const [weekLog,      setWeekLog]      = useState({ dms: 0, emails: 0, today: { dms: 0, emails: 0 } });
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter,       setFilter]       = useState("all");
  const [sortBy,       setSortBy]       = useState("addedAt");
  const [sortDir,      setSortDir]      = useState("desc");

  useEffect(() => { ensureAnalyticsLoaded().then(() => setWeekLog(getWeekLog())); }, []);

  const followUps    = pipeline.filter(l => followUpStatus(l)?.urgent);
  const reEngageReady = pipeline.filter(isReEngageReady);
  const warmLeads    = pipeline.filter(l => l.status === "warm");
  const newLeads     = pipeline.filter(l => l.status === "new");
  const contacted    = pipeline.filter(l => l.status === "contacted" && !followUpStatus(l)?.urgent);
  // Cold/closed list excludes leads already surfaced in re-engage section
  const coldClosed   = pipeline.filter(l => ["cold","closed"].includes(l.status) && !isReEngageReady(l));

  function handleStatusChange(id, newStatus) {
    const patch = { status: newStatus };
    const now   = new Date().toISOString();
    if (newStatus === "contacted") {
      patch.contactedAt = now;
      // Clear follow-up anchor in case lead is being recycled from cold/followup back to contacted
      patch.firstFollowUpAt = null;
    }
    if (newStatus === "followup") {
      // Stamp firstFollowUpAt only if not already set (preserves accurate +7d math on repeat clicks)
      const lead = pipeline.find(l => l.id === id);
      if (!lead?.firstFollowUpAt) patch.firstFollowUpAt = now;
    }
    if (newStatus === "cold") {
      patch.coldAt = now;
    }
    if (newStatus === "new") {
      // Re-engaging from cold — clear cold marker so the 90d clock doesn't double-fire
      patch.coldAt = null;
    }
    onUpdate(id, patch);
  }

  function sortLeads(leads) {
    return [...leads].sort((a, b) => {
      let av, bv;
      if (sortBy === "addedAt") { av = a.addedAt ? new Date(a.addedAt).getTime() : 0; bv = b.addedAt ? new Date(b.addedAt).getTime() : 0; }
      else if (sortBy === "grade") { const o = { A:0,B:1,C:2,D:3 }; av = o[a.grade] ?? 9; bv = o[b.grade] ?? 9; }
      else if (sortBy === "urgency") { av = followUpStatus(a)?.urgent ? 0 : 1; bv = followUpStatus(b)?.urgent ? 0 : 1; }
      else { av = 0; bv = 0; }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("desc"); }
  }

  const filteredAll = filter === "all" ? pipeline : pipeline.filter(l => l.status === filter);
  const visibleAll  = sortLeads(filteredAll);

  const active      = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const closedCt    = pipeline.filter(l => l.status === "closed").length;
  const contactedCt = pipeline.filter(l => l.status !== "new").length;

  const SORT_OPTIONS = [
    { id: "addedAt",  label: "Added"   },
    { id: "grade",    label: "Grade"   },
    { id: "urgency",  label: "Urgent"  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[{ label: "Total", val: pipeline.length, color: C.sub }, { label: "Active", val: active, color: C.green }, { label: "Contacted", val: contactedCt, color: C.blue }, { label: "Closed", val: closedCt, color: C.purple }].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 500, color: s.color, marginBottom: 2 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Label>Outreach log</Label>
          <div style={{ display: "flex", gap: 20 }}>
            {[{ val: weekLog.today.dms, label: "DMs today", color: C.purple }, { val: weekLog.today.emails, label: "Emails today", color: C.green }, { val: weekLog.dms + weekLog.emails, label: "This week", color: C.blue }].map(s => (
              <div key={s.label}>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: s.color }}>{s.val}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: 6 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => { logOutreach("dms");    setWeekLog(getWeekLog()); }} color={C.purple} sm>+ DM Sent</Btn>
          <Btn onClick={() => { logOutreach("emails"); setWeekLog(getWeekLog()); }} color={C.green}  sm>+ Email Sent</Btn>
          <Btn onClick={() => setShowAddModal(true)} color={C.green} sm>+ Add Lead</Btn>
        </div>
      </div>

      {showAddModal && <AddLeadModal onAdd={lead => { onAdd(lead); }} onClose={() => setShowAddModal(false)} />}

      {pipeline.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "20px", textAlign: "center" }}>
          <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No leads yet — search in Leads or hit + Add Lead</p>
        </div>
      ) : (
        <>
          {/* Re-engage (90d+ cold) — top priority, always open */}
          {reEngageReady.length > 0 && (
            <PipelineGridGroup
              title="Re-engage (90d+ cold)"
              color={C.amber}
              leads={sortLeads(reEngageReady)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={true}
            />
          )}

          {/* Follow-ups due — 3-7-7 cadence */}
          {followUps.length > 0 && (
            <PipelineGridGroup
              title="Follow-ups due"
              color={C.red}
              leads={sortLeads(followUps)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={true}
              urgentBorder={true}
            />
          )}

          {warmLeads.length > 0 && (
            <PipelineGridGroup
              title="Warm leads"
              color={C.green}
              leads={sortLeads(warmLeads)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={true}
            />
          )}

          {newLeads.length > 0 && (
            <PipelineGridGroup
              title="New"
              color={C.muted}
              leads={sortLeads(newLeads)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          )}

          {contacted.length > 0 && (
            <PipelineGridGroup
              title="In contact"
              color={C.blue}
              leads={sortLeads(contacted)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          )}

          {coldClosed.length > 0 && (
            <PipelineGridGroup
              title="Cold / closed"
              color={C.muted}
              leads={sortLeads(coldClosed)}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", flexShrink: 0 }}>Filter</span>
              {[{ id: "all", label: `All (${pipeline.length})` }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: `${s.label} (${pipeline.filter(l => l.status === id).length})` }))].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{ fontFamily: MONO, fontSize: 9, padding: "3px 10px", borderRadius: 20, cursor: "pointer", background: filter === f.id ? `${C.green}14` : "transparent", border: `1px solid ${filter === f.id ? C.green : C.border}`, color: filter === f.id ? C.green : C.muted }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", flexShrink: 0 }}>Sort</span>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => toggleSort(opt.id)}
                  style={{ fontFamily: MONO, fontSize: 9, padding: "3px 10px", borderRadius: 20, cursor: "pointer", background: sortBy === opt.id ? `${C.blue}14` : "transparent", border: `1px solid ${sortBy === opt.id ? C.blue : C.border}`, color: sortBy === opt.id ? C.blue : C.muted }}>
                  {opt.label}{sortBy === opt.id ? (sortDir === "asc" ? " ^" : " v") : ""}
                </button>
              ))}
            </div>
          </div>

          {visibleAll.length > 0 && (
            <PipelineGridGroup
              title={`All leads (${visibleAll.length})`}
              color={C.muted}
              leads={visibleAll}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          )}
        </>
      )}
    </div>
  );
}

// --- PROPOSAL MODULE ----------------------------------------------------------
function ProposalModule() {
  const BLANK = { businessName: "", contactName: "", scope: [], scopeNotes: "", timeline: "1 week", carePlan: false, careRate: "200" };
  const [form,     setForm]     = useState(BLANK);
  const [proposal, setProposal] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  const SCOPE_OPTIONS = [
    { id: "new_site",  label: "New Website Build" },
    { id: "redesign",  label: "Redesign / Migration" },
    { id: "care_plan", label: "Monthly Care Plan" },
    { id: "seo",       label: "SEO Setup" },
    { id: "booking",   label: "Booking Integration" },
  ];

  const TIMELINE_OPTIONS = ["As little as 1 week", "2 weeks", "2-3 weeks", "3-4 weeks", "TBD - scope dependent"];

  function toggleScope(id) {
    setForm(f => ({ ...f, scope: f.scope.includes(id) ? f.scope.filter(s => s !== id) : [...f.scope, id] }));
  }

  async function generate() {
    if (!form.businessName.trim() || form.scope.length === 0) return;
    setLoading(true); setProposal(null);

    const scopeLabels = form.scope.map(id => SCOPE_OPTIONS.find(o => o.id === id)?.label).filter(Boolean).join(", ");
    const pricing = form.scope.includes("new_site") && form.scope.includes("care_plan")
      ? "$750 build + $200/month care plan"
      : form.scope.includes("redesign") && form.scope.includes("care_plan")
        ? "Redesign (scope-based) + $200/month care plan"
        : form.scope.includes("new_site")
          ? "$500 one-time build"
          : form.scope.includes("care_plan")
            ? `$${form.careRate}/month care plan`
            : "Scope-based pricing";

    const raw = await ai(
      RWS_CTX + `\n\nWrite a professional web design proposal. Return ONLY valid JSON, no backticks:
{"subject":"Email subject line","greeting":"Short personalized opener, 1-2 sentences","overview":"2-3 sentences describing what RWS will deliver and why it matters for their business specifically","scopeItems":["Array of 4-6 specific deliverable bullets based on scope selected"],"timeline":"1-2 sentence timeline commitment","investment":"1-2 sentences on pricing and payment terms (50% upfront, 50% on launch)","nextSteps":"2-3 sentences on how to proceed - sign agreement, pay deposit, then Trafton handles the rest","closing":"One confident closing sentence"}`,
      `Client: ${form.businessName}${form.contactName ? ` (Contact: ${form.contactName})` : ""} | Scope: ${scopeLabels} | Timeline: ${form.timeline} | Pricing: ${pricing}${form.scopeNotes ? ` | Notes: ${form.scopeNotes}` : ""}`
    );

    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setProposal(parsed);
    } catch { setProposal(null); }
    setLoading(false);
  }

  function buildPlainText() {
    if (!proposal) return "";
    const scopeList = (proposal.scopeItems || []).map(item => `  - ${item}`).join("\n");
    return `Subject: ${proposal.subject}\n\n${proposal.greeting}\n\n${proposal.overview}\n\nSCOPE OF WORK\n${scopeList}\n\nTIMELINE\n${proposal.timeline}\n\nINVESTMENT\n${proposal.investment}\n\nNEXT STEPS\n${proposal.nextSteps}\n\n${proposal.closing}\n\nTrafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com`;
  }

  function copyProposal() {
    navigator.clipboard?.writeText(buildPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 8, padding: "10px 13px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Dot color={C.teal} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Proposal Generator</span>
          <Pill color={C.teal} sm>AI-Drafted</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div><Label>Business Name</Label><input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="ABC Plumbing Co." style={inputStyle} /></div>
          <div><Label>Contact Name</Label><input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Optional — owner name" style={inputStyle} /></div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Label>Scope of Work</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SCOPE_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => toggleScope(opt.id)}
                style={{ fontFamily: MONO, fontSize: 10, padding: "6px 14px", borderRadius: 20, cursor: "pointer", background: form.scope.includes(opt.id) ? `${C.teal}18` : "transparent", border: `1px solid ${form.scope.includes(opt.id) ? C.teal : C.border}`, color: form.scope.includes(opt.id) ? C.teal : C.muted, transition: "all 0.15s" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {form.scope.includes("care_plan") && (
          <div style={{ marginBottom: 16 }}>
            <Label>Care Plan Rate ($/mo)</Label>
            <input value={form.careRate} onChange={e => setForm(f => ({ ...f, careRate: e.target.value }))} placeholder="200" style={{ ...inputStyle, width: 140 }} />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <Label>Timeline</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIMELINE_OPTIONS.map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, timeline: t }))}
                style={{ fontFamily: MONO, fontSize: 10, padding: "6px 14px", borderRadius: 20, cursor: "pointer", background: form.timeline === t ? `${C.teal}18` : "transparent", border: `1px solid ${form.timeline === t ? C.teal : C.border}`, color: form.timeline === t ? C.teal : C.muted }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <Label>Additional Context (optional)</Label>
          <textarea value={form.scopeNotes} onChange={e => setForm(f => ({ ...f, scopeNotes: e.target.value }))} rows={2} placeholder="e.g. They have a Wix site they hate, want booking integration"
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn onClick={generate} loading={loading} disabled={!form.businessName.trim() || form.scope.length === 0} color={C.teal}>Generate Proposal</Btn>
          {proposal && <Btn onClick={() => { setProposal(null); setForm(BLANK); }} color={C.muted} sm>Reset</Btn>}
        </div>
      </Card>

      {loading && <Card><p style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Drafting proposal...</span></p></Card>}

      {proposal && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Dot color={C.teal} />
              <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Proposal — {form.businessName}</span>
            </div>
            <Btn onClick={copyProposal} color={copied ? C.green : C.muted} sm>{copied ? "Copied" : "Copy Plain Text"}</Btn>
          </div>
          <div style={{ padding: "10px 14px", background: `${C.teal}08`, borderRadius: 8, border: `1px solid ${C.teal}20`, marginBottom: 16 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.teal, letterSpacing: "0.1em" }}>SUBJECT  </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>{proposal.subject}</span>
          </div>
          {[{ label: "Opening", content: proposal.greeting }, { label: "Overview", content: proposal.overview }].map(s => s.content && (
            <div key={s.label} style={{ marginBottom: 16 }}>
              <Label>{s.label}</Label>
              <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.75, color: C.sub, margin: 0 }}>{s.content}</p>
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <Label>Scope of Work</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(proposal.scopeItems || []).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.teal, flexShrink: 0, marginTop: 2 }}>—</span>
                  <span style={{ fontFamily: BODY, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {[{ label: "Timeline", content: proposal.timeline }, { label: "Investment", content: proposal.investment }, { label: "Next Steps", content: proposal.nextSteps }, { label: "Closing", content: proposal.closing }].map(s => s.content && (
            <div key={s.label} style={{ marginBottom: 16 }}>
              <Label>{s.label}</Label>
              <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.75, color: C.sub, margin: 0 }}>{s.content}</p>
            </div>
          ))}
          <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com</span>
          </div>
        </Card>
      )}
    </div>
  );
}

// --- CLIENT TRACKER -----------------------------------------------------------
function ClientTracker() {
  const [clients,   setClientsRaw] = useState([]);
  const [loaded,    setLoaded]     = useState(false);
  const [adding,    setAdding]     = useState(false);
  const [editingId, setEditingId]  = useState(null);
  const BLANK_CLIENT = { name: "", siteUrl: "", carePlan: false, careRate: "", launchedAt: "", lastCheckIn: "", nextInvoice: "", notes: "" };
  const [form, setForm] = useState(BLANK_CLIENT);

  useEffect(() => { loadClients().then(c => { setClientsRaw(c); setLoaded(true); }); }, []);

  function save(updated) { setClientsRaw(updated); saveClients(updated); }
  function addClient() {
    if (!form.name.trim()) return;
    save([...clients, { id: `${Date.now()}-${Math.random()}`, ...form, addedAt: new Date().toISOString() }]);
    setForm(BLANK_CLIENT); setAdding(false);
  }
  function updateClient(id, patch) { save(clients.map(c => c.id === id ? { ...c, ...patch } : c)); }
  function removeClient(id)        { save(clients.filter(c => c.id !== id)); }

  function daysSinceCheckIn(client) {
    if (!client.lastCheckIn) return null;
    const ts = Date.parse(client.lastCheckIn);
    if (isNaN(ts)) return null;
    return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  }
  function checkInOverdue(client) { const days = daysSinceCheckIn(client); return days !== null && days >= 30; }

  const overdueClients = clients.filter(checkInOverdue);
  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 11px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" };

  if (!loaded) return <Card><p style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Loading clients...</span></p></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {overdueClients.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Dot color={C.amber} pulse />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, letterSpacing: "0.12em", textTransform: "uppercase" }}>Check-in overdue ({overdueClients.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdueClients.map(c => {
              const days = daysSinceCheckIn(c);
              return (
                <div key={c.id} style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</span>
                    {c.siteUrl && <a href={c.siteUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.blue, marginLeft: 10, textDecoration: "none" }}>{c.siteUrl.replace(/https?:\/\//, "")}</a>}
                    <p style={{ fontFamily: MONO, fontSize: 10, color: C.amber, margin: "3px 0 0" }}>{days}d since last check-in</p>
                  </div>
                  <Btn sm color={C.green} onClick={() => updateClient(c.id, { lastCheckIn: new Date().toISOString() })}>Mark Checked In</Btn>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dot color={C.teal} />
            <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Clients</span>
            <Pill color={C.teal} sm>{clients.length} active</Pill>
          </div>
          <Btn onClick={() => setAdding(a => !a)} color={C.teal} sm>{adding ? "Cancel" : "+ Add Client"}</Btn>
        </div>
        {adding && (
          <div style={{ background: `${C.teal}06`, border: `1px solid ${C.teal}20`, borderRadius: 10, padding: "16px", marginBottom: 20 }}>
            <Label>New Client</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[{ key: "name", label: "Business Name", placeholder: "ABC Plumbing Co." }, { key: "siteUrl", label: "Site URL", placeholder: "https://..." }, { key: "launchedAt", label: "Launch Date", placeholder: "YYYY-MM-DD" }, { key: "nextInvoice", label: "Next Invoice", placeholder: "YYYY-MM-DD" }].map(f => (
                <div key={f.key}>
                  <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{f.label}</p>
                  <input value={form[f.key]} onChange={e => setForm(f2 => ({ ...f2, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={form.carePlan} onChange={e => setForm(f => ({ ...f, carePlan: e.target.checked }))} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>Care Plan Active</span>
              </label>
              {form.carePlan && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>$/mo</span>
                <input value={form.careRate} onChange={e => setForm(f => ({ ...f, careRate: e.target.value }))} placeholder="200" style={{ ...inputStyle, width: 80 }} />
              </div>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</p>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <Btn onClick={addClient} disabled={!form.name.trim()} color={C.teal} sm>Save Client</Btn>
          </div>
        )}
        {clients.length === 0
          ? <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No clients yet.</p>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clients.map(c => {
                const isEditing = editingId === c.id;
                const days = daysSinceCheckIn(c);
                const overdue = checkInOverdue(c);
                return (
                  <div key={c.id} style={{ background: C.cardHi, border: `1px solid ${overdue ? C.amber + "40" : C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</span>
                          {c.carePlan && <Pill color={C.green} sm>Care Plan {c.careRate ? `$${c.careRate}/mo` : ""}</Pill>}
                          {overdue && <Pill color={C.amber} sm>Check-in overdue</Pill>}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                          {c.siteUrl && <a href={c.siteUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>{c.siteUrl.replace(/https?:\/\//, "")}</a>}
                          {c.launchedAt && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Launched {c.launchedAt}</span>}
                          {c.nextInvoice && <span style={{ fontFamily: MONO, fontSize: 10, color: C.purple }}>Invoice {c.nextInvoice}</span>}
                        </div>
                        {days !== null && <span style={{ fontFamily: MONO, fontSize: 10, color: overdue ? C.amber : C.muted }}>{days === 0 ? "Checked in today" : `Last check-in: ${days}d ago`}</span>}
                        {c.notes && <p style={{ fontFamily: MONO, fontSize: 10, color: C.sub, margin: "4px 0 0", fontStyle: "italic" }}>{c.notes}</p>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                        <Btn onClick={() => updateClient(c.id, { lastCheckIn: new Date().toISOString() })} color={C.green} sm>Check In</Btn>
                        <Btn onClick={() => setEditingId(isEditing ? null : c.id)} color={C.purple} sm>{isEditing ? "Cancel" : "Edit"}</Btn>
                        <Btn onClick={() => removeClient(c.id)} color={C.red} sm>Remove</Btn>
                      </div>
                    </div>
                    {isEditing && (
                      <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "rgba(171,71,188,0.04)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          {[{ key: "name", label: "Business Name" }, { key: "siteUrl", label: "Site URL" }, { key: "launchedAt", label: "Launch Date" }, { key: "nextInvoice", label: "Next Invoice" }].map(f => (
                            <div key={f.key}>
                              <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{f.label}</p>
                              <input defaultValue={c[f.key] || ""} onBlur={e => updateClient(c.id, { [f.key]: e.target.value })} style={inputStyle} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={c.carePlan} onChange={e => updateClient(c.id, { carePlan: e.target.checked })} />
                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>Care Plan Active</span>
                          </label>
                          {c.carePlan && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>$/mo</span>
                            <input defaultValue={c.careRate || ""} onBlur={e => updateClient(c.id, { careRate: e.target.value })} style={{ ...inputStyle, width: 80 }} />
                          </div>}
                        </div>
                        <div>
                          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</p>
                          <textarea defaultValue={c.notes || ""} onBlur={e => updateClient(c.id, { notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                        </div>
                        <div style={{ marginTop: 10 }}><Btn onClick={() => setEditingId(null)} color={C.green} sm>Done</Btn></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        }
      </Card>
    </div>
  );
}

// --- HASHTAG MODULE -----------------------------------------------------------
function HashtagModule() {
  const TAGS = {
    location: ["#orangecounty","#orangecountyca","#anaheim","#socalbusiness","#southerncalifornia","#oclocal","#inlandempire","#losangelesbusiness"],
    business: ["#smallbusinessowner","#localbusiness","#smallbusiness","#independentbusiness","#solopreneur","#businessowner","#entrepreneurs"],
    niche: ["#nailtech","#nailbusiness","#handyman","#handymanservices","#contractorbusiness","#independentmotel","#hospitalitybusiness","#tradesbusiness","#servicebusiness"],
    web: ["#webdesign","#websitedesign","#webdesigner","#smallbusinesswebsite","#websitedesignorangecounty","#webdesignorangecounty","#localseo","#digitalmarketing","#onlinepresence"],
    pain: ["#getfoundgoogle","#needawebsite","#nowebsite","#growyourbusiness","#getmorecustomers","#morereviews","#bookmoreclients"],
    community: ["#ocbusiness","#orangecountybusiness","#orangecountyentrepreneur","#supportlocal","#shoplocal","#ocsmallbusiness"],
  };
  const NICHE_OPTIONS = [
    { id: "any", label: "Any / General" }, { id: "nail", label: "Nail Tech" },
    { id: "handyman", label: "Handyman" }, { id: "motel", label: "Motel / Hospitality" },
    { id: "trades", label: "Trades" }, { id: "cleaning", label: "Cleaning / Landscaping" },
  ];
  const NICHE_TAG_MAP = {
    nail: ["#nailtech","#nailbusiness"], handyman: ["#handyman","#handymanservices"],
    motel: ["#independentmotel","#hospitalitybusiness"], trades: ["#contractorbusiness","#tradesbusiness"],
    cleaning: ["#servicebusiness","#tradesbusiness"], any: ["#servicebusiness","#smallbusinessowner"],
  };

  const [niche,     setNiche]     = useState("any");
  const [generated, setGenerated] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [copied,    setCopied]    = useState(false);

  function pick(arr, n, exclude = []) {
    return [...arr.filter(t => !exclude.includes(t))].sort(() => Math.random() - 0.5).slice(0, n);
  }

  function generate() {
    const lastSet   = history[history.length - 1] || [];
    const nichetags = NICHE_TAG_MAP[niche] || NICHE_TAG_MAP.any;
    const set = [...pick(TAGS.location,3,lastSet), ...nichetags, ...pick(TAGS.web,2,lastSet), ...pick(TAGS.pain,2,lastSet), ...pick(TAGS.community,1,lastSet)];
    setGenerated(set);
    setHistory(h => [...h.slice(-9), set]);
    setCopied(false);
  }

  function tagCategory(tag) {
    const nicheTagSet = new Set(NICHE_TAG_MAP[niche] || []);
    if (TAGS.location.includes(tag))  return C.blue;
    if (nicheTagSet.has(tag))         return C.green;
    if (TAGS.web.includes(tag))       return C.purple;
    if (TAGS.pain.includes(tag))      return C.amber;
    if (TAGS.community.includes(tag)) return C.teal;
    return C.muted;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Dot color={C.purple} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Hashtag Generator</span>
          <Pill color={C.purple} sm>Instagram</Pill>
        </div>
        <Label>Post Niche</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {NICHE_OPTIONS.map(o => (
            <button key={o.id} onClick={() => setNiche(o.id)}
              style={{ fontFamily: MONO, fontSize: 10, padding: "5px 13px", borderRadius: 20, cursor: "pointer", background: niche === o.id ? `${C.purple}18` : "transparent", border: `1px solid ${niche === o.id ? C.purple : C.border}`, color: niche === o.id ? C.purple : C.muted }}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <Btn onClick={generate} color={C.purple}>Generate Set</Btn>
          {generated && <Btn onClick={generate} color={C.muted} sm>Regenerate</Btn>}
          {generated && <Btn onClick={() => { navigator.clipboard?.writeText(generated.join(" ")); setCopied(true); setTimeout(() => setCopied(false), 2000); }} color={copied ? C.green : C.muted} sm>{copied ? "Copied" : "Copy All"}</Btn>}
        </div>
        {generated && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "16px", background: "rgba(0,0,0,0.25)", borderRadius: 10, border: `1px solid ${C.border}` }}>
            {generated.map(tag => {
              const color = tagCategory(tag);
              return (
                <span key={tag} onClick={() => navigator.clipboard?.writeText(tag)}
                  style={{ fontFamily: MONO, fontSize: 11, color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// --- ANALYTICS MODULE ---------------------------------------------------------
function AnalyticsModule({ pipeline }) {
  const [ready, setReady] = useState(_analyticsLoaded);
  const [, setTick]       = useState(0);

  useEffect(() => {
    if (!_analyticsLoaded) ensureAnalyticsLoaded().then(() => { setReady(true); setTick(t => t + 1); });
  }, []);

  if (!ready) return <Card><p style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Loading analytics...</span></p></Card>;

  const outreachLog  = _outreachLog;
  const nicheHistory = _nicheHistory;
  const statusCounts = Object.keys(STATUS).reduce((acc, s) => { acc[s] = pipeline.filter(l => l.status === s).length; return acc; }, {});
  const total     = pipeline.length;
  const contacted = pipeline.filter(l => l.status !== "new").length;
  const warm      = pipeline.filter(l => ["warm","closed"].includes(l.status)).length;
  const closed    = pipeline.filter(l => l.status === "closed").length;

  // --- Channel performance --------------------------------------------------
  // Slices pipeline by lastChannel ("dm" or "email") and reports funnel rates per channel.
  // Only counts leads that have at least one outreach touch (status != new AND has lastChannel).
  function channelStats(channel) {
    const touched = pipeline.filter(l => l.lastChannel === channel && l.status !== "new");
    const reply   = touched.filter(l => ["warm","closed","followup"].includes(l.status)).length;
    const warm    = touched.filter(l => ["warm","closed"].includes(l.status)).length;
    const closed  = touched.filter(l => l.status === "closed").length;
    return {
      touched: touched.length,
      reply,
      replyPct:  touched.length ? Math.round((reply  / touched.length) * 100) : 0,
      warm,
      warmPct:   touched.length ? Math.round((warm   / touched.length) * 100) : 0,
      closed,
      closedPct: touched.length ? Math.round((closed / touched.length) * 100) : 0,
    };
  }
  const dmStats     = channelStats("dm");
  const emailStats  = channelStats("email");
  const noChannelCt = pipeline.filter(l => l.status !== "new" && !l.lastChannel).length;
  const hasChannelData = dmStats.touched + emailStats.touched > 0;

  const outreachDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const key = d.toLocaleDateString("en-CA");
    return { key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), dms: outreachLog[key]?.dms || 0, emails: outreachLog[key]?.emails || 0 };
  });
  const totalDMs    = outreachDays.reduce((a, d) => a + d.dms, 0);
  const totalEmails = outreachDays.reduce((a, d) => a + d.emails, 0);
  const activeDays  = outreachDays.filter(d => d.dms + d.emails > 0).length;
  const maxActivity = Math.max(...outreachDays.map(d => d.dms + d.emails), 1);

  const nicheMap = {};
  nicheHistory.forEach(({ query, aCount, bCount }) => {
    if (!nicheMap[query]) nicheMap[query] = { searches: 0, aTotal: 0, bTotal: 0 };
    nicheMap[query].searches++; nicheMap[query].aTotal += aCount; nicheMap[query].bTotal += bCount;
  });
  const nicheRows = Object.entries(nicheMap).map(([q, v]) => ({ query: q, ...v, avgA: v.searches ? (v.aTotal / v.searches).toFixed(1) : 0 })).sort((a, b) => b.aTotal - a.aTotal).slice(0, 10);
  const gradeMap  = { A: 0, B: 0, C: 0, D: 0 };
  pipeline.forEach(l => { if (l.grade) gradeMap[l.grade]++; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><Dot color={C.green} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Pipeline Funnel</span></div>
        {total === 0 ? <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No pipeline leads yet.</p> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[{ label: "Total", val: total, color: C.sub, pct: null }, { label: "Contacted", val: contacted, color: C.blue, pct: total ? Math.round(contacted/total*100) : 0 }, { label: "Warm", val: warm, color: C.green, pct: contacted ? Math.round(warm/contacted*100) : 0 }, { label: "Closed", val: closed, color: C.purple, pct: warm ? Math.round(closed/warm*100) : 0 }].map(s => (
                <div key={s.label} style={{ background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, color: s.color, marginBottom: 3 }}>{s.val}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: s.pct !== null ? 4 : 0 }}>{s.label}</div>
                  {s.pct !== null && <div style={{ fontFamily: MONO, fontSize: 10, color: s.color }}>{s.pct}% conv.</div>}
                </div>
              ))}
            </div>
            <Label>Status Breakdown</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {Object.entries(STATUS).map(([id, st]) => {
                const count = statusCounts[id] || 0;
                const pct   = total ? (count / total) * 100 : 0;
                return (
                  <div key={id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 32px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: st.color }}>{st.label}</span>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: st.color, borderRadius: 3, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <Label>Pipeline Grade Mix</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(gradeMap).map(([g, count]) => (
                <div key={g} style={{ flex: 1, background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", textAlign: "center" }}>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: GRADE_COLOR[g], marginBottom: 2 }}>{count}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase" }}>Grade {g}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Channel Performance — new card */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Dot color={C.teal} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Channel Performance</span>
          <Pill color={C.muted} sm>Per-lead conversion by channel</Pill>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          Tracks how leads progress after their first outreach via DM vs Email. Channel stamped when you copy a DM or send an email from the lead's pipeline card.
        </p>
        {!hasChannelData ? (
          <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>
            No channel data yet — channel is stamped when you copy a DM or send an email from a Pipeline card.
            {noChannelCt > 0 && ` ${noChannelCt} contacted lead${noChannelCt === 1 ? "" : "s"} missing channel attribution.`}
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Instagram DM", stats: dmStats,    color: C.purple },
                { label: "Email",        stats: emailStats, color: C.green  },
              ].map(({ label, stats, color }) => (
                <div key={label} style={{ background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Dot color={color} size={6} />
                    <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: "auto" }}>{stats.touched} touched</span>
                  </div>
                  {stats.touched === 0 ? (
                    <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: 0 }}>No data yet</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { metric: "Reply rate", count: stats.reply,   pct: stats.replyPct,   color: C.blue },
                        { metric: "Warm rate",  count: stats.warm,    pct: stats.warmPct,    color: C.green },
                        { metric: "Close rate", count: stats.closed,  pct: stats.closedPct,  color: C.purple },
                      ].map(row => (
                        <div key={row.metric} style={{ display: "grid", gridTemplateColumns: "80px 1fr 50px", gap: 8, alignItems: "center" }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{row.metric}</span>
                          <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: 3, transition: "width 0.4s ease" }} />
                          </div>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: row.color, textAlign: "right" }}>{row.pct}% ({row.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {dmStats.touched > 0 && emailStats.touched > 0 && (
              <div style={{ padding: "10px 14px", background: `${C.amber}06`, borderRadius: 8, border: `1px solid ${C.amber}20` }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, letterSpacing: "0.1em" }}>BENCHMARK  </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub, lineHeight: 1.6 }}>
                  Industry: IG DM ~13% reply / 3% close · Cold email ~3-5% reply / 1% close. Your numbers above {dmStats.touched + emailStats.touched < 20 ? "are early — need 20+ touched leads per channel to be meaningful" : "are statistically meaningful"}.
                </span>
              </div>
            )}
            {noChannelCt > 0 && (
              <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "10px 0 0", fontStyle: "italic" }}>
                Note: {noChannelCt} contacted lead{noChannelCt === 1 ? "" : "s"} missing channel attribution (contacted before tracking added or marked via manual + DM/Email buttons).
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Dot color={C.purple} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Outreach Activity</span><Pill color={C.muted} sm>30 days</Pill></div>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ val: totalDMs, label: "DMs", color: C.purple }, { val: totalEmails, label: "Emails", color: C.green }, { val: activeDays, label: "Active days", color: C.blue }].map(s => (
              <div key={s.label} style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, color: s.color }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        {totalDMs + totalEmails === 0
          ? <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No outreach logged yet.</p>
          : <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60, marginBottom: 8 }}>
                {outreachDays.map((d, i) => {
                  const tot = d.dms + d.emails;
                  const h   = tot ? Math.max(4, (tot / maxActivity) * 60) : 2;
                  return <div key={i} title={`${d.label}: ${d.dms} DMs, ${d.emails} emails`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    <div style={{ width: "100%", borderRadius: "2px 2px 0 0", background: tot ? `linear-gradient(to top, ${C.green}90, ${C.purple}90)` : "rgba(255,255,255,0.04)", height: h }} />
                  </div>;
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{outreachDays[0]?.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{outreachDays[29]?.label}</span>
              </div>
            </>
        }
      </Card>
      {nicheRows.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><Dot color={C.amber} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Niche Performance</span></div>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 60px", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
              {["Niche + Location","Searches","A Leads","B Leads","Avg A"].map(h => <span key={h} style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h === "Niche + Location" ? "left" : "right" }}>{h}</span>)}
            </div>
            {nicheRows.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 60px", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.query}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub,   textAlign: "right" }}>{row.searches}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.green, textAlign: "right" }}>{row.aTotal}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber, textAlign: "right" }}>{row.bTotal}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.blue,  textAlign: "right" }}>{row.avgA}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// --- SIDEBAR ------------------------------------------------------------------
function Sidebar({ activeTab, onTabChange, pipeline }) {
  const followUpDue    = pipeline.filter(l => followUpStatus(l)?.urgent).length;
  const reEngageReady  = pipeline.filter(isReEngageReady).length;
  const activePipeline = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;

  // Badge priority: re-engage > follow-ups > active count
  const pipelineBadge = reEngageReady > 0
    ? { text: `${reEngageReady} re-engage`, color: C.amber }
    : followUpDue > 0
      ? { text: `${followUpDue} due`, color: C.red }
      : activePipeline > 0
        ? { text: `${activePipeline}`, color: C.green }
        : null;

  const sections = [
    {
      label: "Outreach",
      items: [
        { id: "leads",    label: "Leads",    dot: C.amber  },
        { id: "pipeline", label: "Pipeline", dot: pipelineBadge?.color || C.green, badge: pipelineBadge?.text, badgeColor: pipelineBadge?.color },
        { id: "outreach", label: "Copy",     dot: C.purple },
      ],
    },
    {
      label: "Business",
      items: [
        { id: "proposal", label: "Proposals", dot: C.teal },
        { id: "clients",  label: "Clients",   dot: C.teal },
      ],
    },
    {
      label: "Insights",
      items: [
        { id: "analytics", label: "Analytics", dot: C.blue   },
        { id: "hashtags",  label: "Hashtags",  dot: C.purple },
      ],
    },
  ];

  return (
    <div style={{ width: 192, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border2}`, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Dot color={C.green} pulse size={7} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.text, letterSpacing: "0.04em" }}>RWS Command</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, paddingLeft: 15 }}>ops.rogers-websolutions.com</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
        {sections.map((section, si) => (
          <div key={section.label}>
            {si > 0 && <div style={{ borderTop: `1px solid ${C.border}`, margin: "8px 0" }} />}
            <div style={{ padding: "6px 16px 4px" }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: C.muted, letterSpacing: "0.18em", textTransform: "uppercase" }}>{section.label}</span>
            </div>
            {section.items.map(item => (
              <div key={item.id} onClick={() => onTabChange(item.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", margin: "1px 6px", borderRadius: 7, cursor: "pointer", background: activeTab === item.id ? "rgba(255,255,255,0.07)" : "transparent", transition: "background 0.12s" }}>
                <Dot color={item.dot} size={5} />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: activeTab === item.id ? C.text : C.muted, flex: 1, transition: "color 0.12s" }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontFamily: MONO, fontSize: 8, padding: "1px 6px", borderRadius: 10, background: `${item.badgeColor}14`, color: item.badgeColor, border: `1px solid ${item.badgeColor}30` }}>{item.badge}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
        {[{ color: C.green, label: "AI connected" }, { color: C.green, label: "Pipeline synced" }].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Dot color={s.color} size={4} />
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- COMMAND CENTER -----------------------------------------------------------
function CommandCenter({ prepData }) {
  const [tab,            setTab]           = useState("leads");
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [leadsState,     setLeadsState]    = useState({
    niche:     prepData?.niche?.split(" — ")[0] || "",
    location:  prepData?.niche?.split(" — ")[1] || "Orange County, California",
    prospects: prepData?.prospects || [],
    loading:   false,
    error:     "",
  });
  const [outreachState, setOutreachState] = useState({ type: "cold" });
  const [pipeline,      setPipelineRaw]   = useState([]);

  useEffect(() => {
    if (prepData?.pipeline?.length > 0) { setPipelineRaw(prepData.pipeline); setPipelineLoaded(true); }
    else { loadPipeline().then(saved => { setPipelineRaw(saved); setPipelineLoaded(true); }); }
    ensureAnalyticsLoaded();
  }, []);

  useEffect(() => {
    if (pipelineLoaded && pipeline.length >= 0) savePipeline(pipeline);
  }, [pipeline, pipelineLoaded]);

  function addToPipeline(prospect) {
    if (pipelineNames.has(prospect.name)) return;
    setPipelineRaw(p => [...p, { id: `${Date.now()}-${Math.random()}`, status: prospect.status || "new", notes: "", addedAt: new Date().toISOString(), contactedAt: null, ...prospect }]);
  }

  function updateLead(id, patch) { setPipelineRaw(p => p.map(l => l.id === id ? { ...l, ...patch } : l)); }
  function removeLead(id)        { setPipelineRaw(p => p.filter(l => l.id !== id)); }

  const pipelineNames  = new Set(pipeline.map(l => l.name));
  const followUpDue    = pipeline.filter(l => followUpStatus(l)?.urgent).length;
  const reEngageReady  = pipeline.filter(isReEngageReady).length;

  const PANEL_HEADERS = {
    leads:     { title: "Leads",           sub: leadsState.prospects.length > 0 ? `${leadsState.prospects.length} results` : "Google Maps real data" },
    pipeline:  { title: "Pipeline",        sub: `${pipeline.length} total${followUpDue > 0 ? ` · ${followUpDue} follow-ups due` : ""}${reEngageReady > 0 ? ` · ${reEngageReady} ready to re-engage` : ""}` },
    outreach:  { title: "Copy Generator",  sub: "IG DMs · emails · follow-ups" },
    proposal:  { title: "Proposals",       sub: "AI-drafted in your voice" },
    clients:   { title: "Clients",         sub: "Active accounts + check-in tracker" },
    analytics: { title: "Analytics",       sub: "Funnel · channel performance · activity" },
    hashtags:  { title: "Hashtags",        sub: "Instagram sets" },
  };

  const header = PANEL_HEADERS[tab] || { title: tab, sub: "" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <Sidebar activeTab={tab} onTabChange={setTab} pipeline={pipeline} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "hidden" }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, letterSpacing: "0.08em", textTransform: "uppercase" }}>{header.title}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 2 }}>{header.sub}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Dot color={C.green} size={4} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>AI</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Dot color={pipelineLoaded ? C.green : C.amber} size={4} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>Pipeline</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ display: tab === "leads"     ? "block" : "none" }}><LeadScraper    state={leadsState}    setState={setLeadsState}    onAdd={addToPipeline} pipelineNames={pipelineNames} /></div>
          <div style={{ display: tab === "outreach"  ? "block" : "none" }}><OutreachModule state={outreachState} setState={setOutreachState} pipeline={pipeline} /></div>
          <div style={{ display: tab === "pipeline"  ? "block" : "none" }}><PipelineModule pipeline={pipeline}   onUpdate={updateLead}       onRemove={removeLead} onAdd={addToPipeline} /></div>
          <div style={{ display: tab === "proposal"  ? "block" : "none" }}><ProposalModule /></div>
          <div style={{ display: tab === "clients"   ? "block" : "none" }}><ClientTracker /></div>
          <div style={{ display: tab === "analytics" ? "block" : "none" }}><AnalyticsModule pipeline={pipeline} /></div>
          <div style={{ display: tab === "hashtags"  ? "block" : "none" }}><HashtagModule /></div>
        </div>
      </div>

      <style>{`
        @keyframes blink  {0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes ripple {0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)}100%{box-shadow:0 0 0 12px rgba(0,230,118,0)}}
        *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.78}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>
    </div>
  );
}

// --- ROOT ---------------------------------------------------------------------
export default function Page() {
  const [unlocked, setUnlocked] = useState(false);
  const [entered,  setEntered]  = useState(false);
  const [prepData, setPrepData] = useState(null);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  if (!entered)  return <LoginScreen onEnter={() => setEntered(true)} onPrepReady={setPrepData} />;
  return <CommandCenter prepData={prepData} />;
}
