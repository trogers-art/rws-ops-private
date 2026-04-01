"use client";
import React, { useState, useEffect, useCallback } from "react";

const C = {
  bg:      "#07080b",
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
  closed:    { label: "Closed",    color: C.purple },
  cold:      { label: "Cold",      color: C.red    },
};

const GRADE_COLOR = { A: C.green, B: C.amber, C: C.blue, D: C.muted };

const RWS_CTX = `You are the AI operations assistant for Rogers Web Solutions (RWS), a web design agency in Anaheim / Orange County, CA run by Trafton Rogers.

KEY FACTS:
- Trafton works a full-time day job 8-5 M-F as a Senior Network Engineer in Anaheim
- RWS builds affordable websites ($500-$1,000) with monthly care plans ($150-$300/mo)
- Target clients: local OC small businesses — trades (HVAC, plumbing, electrical), nail techs, handymen, independent motels, Instagram-based service businesses
- Email: trogers@rogers-websolutions.com | Book a call: https://www.rogers-websolutions.com/book
- Only available evenings and weekends

TRAFTON'S VOICE — follow this exactly:
- Direct and confident. Get to the point in the first sentence.
- Consultative, not salesy. Point out a real problem, don't pitch a product.
- Data-driven. Reference real ratings, review counts, missing website specifically.
- Short. Every word earns its place.
- Low-pressure close. Invite a conversation, send them to https://www.rogers-websolutions.com/book to book.
- NEVER say: leverage, digital footprint, I'd love the opportunity, I hope this finds you well, we help businesses grow
- NEVER use em-dashes, exclamation points, or fake casual openers
- NEVER invent data. Only use facts provided about the actual business.

EMAIL SIGNATURE — always end emails with exactly this, on its own line:
Trafton Rogers | RWS | trogers@rogers-websolutions.com

DM SIGN-OFF — always end DMs with this on its own line:
Trafton Rogers | RWS | trogers@rogers-websolutions.com`;

const NICHES = [
  "HVAC companies Orange County",
  "nail salons Anaheim",
  "handymen Tustin",
  "plumbers Orange County",
  "electricians Fullerton",
  "motels Orange County",
  "landscapers Anaheim",
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
  } catch (e) { return `Error: ${e.message}`; }
}

async function enrichLead(lead) {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lead.name, website: lead.website, city: lead.city, category: lead.category, phone: lead.phone }),
    });
    const data = await res.json();
    return data || { enriched: false };
  } catch (e) {
    console.error("enrichLead fetch error:", e);
    return { enriched: false, error: e.message };
  }
}

async function fetchGmail() {
  const res = await fetch("/api/gmail");
  return res.json();
}

async function fetchCalendar(days = 7) {
  const res = await fetch(`/api/calendar?days=${days}`);
  return res.json();
}

async function fetchLeads(query) {
  const res = await fetch(`/api/leads?q=${encodeURIComponent(query)}`);
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
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function loadPipeline() {
  try {
    const res = await fetch("/api/pipeline", {
      headers: { "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "" },
    });
    const d = await res.json();
    return d.pipeline || [];
  } catch { return []; }
}

async function savePipeline(pipeline) {
  try {
    await fetch("/api/pipeline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "",
      },
      body: JSON.stringify({ pipeline }),
    });
  } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseIgHandle(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("http")) {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0] || "";
    }
  } catch {}
  return trimmed.replace(/^@/, "");
}

function resolvedGrade(lead) {
  if (!lead.email && !lead.instagram && (lead.grade === "A" || lead.grade === "B")) return "D";
  return lead.grade || "D";
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Pill({ color, children, sm }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: sm ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: sm ? "2px 7px" : "3px 9px", borderRadius: 20, background: `${color}14`, color, border: `1px solid ${color}28`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Dot({ color, pulse, size = 7 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 ${pulse ? 0 : 6}px ${color}80`, animation: pulse ? "ripple 2s ease-out infinite" : "none" }} />;
}

function Btn({ onClick, disabled, loading, children, color = C.green, sm }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ fontFamily: MONO, fontSize: sm ? 10 : 11, letterSpacing: "0.07em", fontWeight: 500, padding: sm ? "5px 11px" : "9px 18px", borderRadius: 7, cursor: (disabled || loading) ? "not-allowed" : "pointer", background: (disabled || loading) ? "rgba(255,255,255,0.03)" : `${color}12`, border: `1px solid ${(disabled || loading) ? "rgba(255,255,255,0.07)" : color + "45"}`, color: (disabled || loading) ? C.muted : color, transition: "all 0.15s" }}>
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
  if (!value) return <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>{placeholder}</p>;
  return <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.85, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "13px 15px", border: `1px solid ${C.border}` }}>{value}</div>;
}

function Field({ value, onChange, placeholder, rows, onKeyDown }) {
  const shared = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 8, padding: "10px 13px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" };
  return rows
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...shared, resize: "vertical" }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown} style={shared} />;
}

function CopyBtn({ text, label = "Copy", sm, onCopy }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  }
  return (
    <button onClick={copy} style={{
      fontFamily: MONO, fontSize: sm ? 10 : 11, letterSpacing: "0.07em", fontWeight: 500,
      padding: sm ? "5px 11px" : "9px 18px", borderRadius: 7, cursor: "pointer",
      background: copied ? `${C.green}22` : "rgba(255,255,255,0.08)",
      border: `1px solid ${copied ? C.green : "rgba(255,255,255,0.25)"}`,
      color: copied ? C.green : C.text,
      transition: "all 0.15s",
    }}>
      {copied ? "Copied" : label}
    </button>
  );
}

// ─── PIN GATE ─────────────────────────────────────────────────────────────────
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
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 16px" }}>RWS · Anaheim</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, color: C.white, margin: "0 0 32px" }}>Command Center</h1>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} placeholder="PIN" maxLength={8}
          style={{ display: "block", width: 180, margin: "0 auto 12px", background: error ? "rgba(239,83,80,0.08)" : "rgba(0,0,0,0.4)", border: `1px solid ${error ? C.red : C.border2}`, borderRadius: 8, padding: "12px 16px", textAlign: "center", fontFamily: MONO, fontSize: 20, color: C.text, outline: "none", letterSpacing: "0.3em", transition: "all 0.2s" }}
        />
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "0 0 12px" }}>incorrect</p>}
        <Btn onClick={check} disabled={pin.length < 1} color={C.green}>Unlock</Btn>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}} *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.8}`}</style>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
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
    const briefP = ai(
      RWS_CTX + `\n\nGenerate a daily briefing. Return ONLY valid JSON, no backticks:
{"synopsis":"2-3 sentences. Day/date. Weekend means no day job.","focus":"Single highest-leverage RWS task today.","tech":"2 sentences on a specific real networking/AI/web infrastructure trend relevant to a Senior Network Engineer building a web side business. Name actual tech.","motivation":"One grounded punchy sentence. No quotes. Not cheesy."}`,
      `Today: ${dayStr}. Weekend: ${isWeekend}. Hour: ${hour}. Location: Anaheim CA.`
    ).then(raw => {
      try { setBrief(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
      catch { setBrief({ synopsis: `It's ${dayStr}. ${isWeekend ? "No day job today." : "Day job 8-5."} Calendar is clear.`, focus: "Follow up with warm leads and queue outreach for today's niche.", tech: "eBPF-based observability is reshaping how network engineers instrument traffic without kernel changes.", motivation: "You don't need perfect conditions — you need reps." }); }
      setLoading(false);
    });

    const prepP = (async () => {
      try {
        const data = await fetchLeads(todayNiche);
        logNicheSearch(todayNiche, data.aGrade || 0, data.bGrade || 0);
        const allResults  = data.prospects || [];
        const candidates  = allResults.filter(p => p.grade === "A" || p.grade === "B").slice(0, 8);
        const rest        = allResults.filter(p => p.grade !== "A" && p.grade !== "B").slice(0, 4);

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
          !!(p.email || p.instagram) &&
          !existingNames.has(p.name) &&
          !dismissed.has(p.name)
        );

        let updatedPipeline = existingPipeline;
        if (toAdd.length > 0) {
          const newEntries = toAdd.map(p => ({
            id:      `${Date.now()}-${Math.random()}`,
            status:  "new",
            notes:   "",
            addedAt: new Date().toLocaleDateString(),
            ...p,
          }));
          updatedPipeline = [...existingPipeline, ...newEntries];
          await savePipeline(updatedPipeline);
        }

        const allProspects = [...enrichedCandidates, ...rest];
        onPrepReady({ prospects: allProspects, niche: todayNiche, autoPipelined: toAdd.length, pipeline: updatedPipeline });
      } catch (e) { console.error("prep error", e); }
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
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", backgroundImage: `radial-gradient(ellipse 55% 45% at 50% -5%, rgba(0,230,118,0.06) 0%, transparent 60%)` }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.4s ease both", opacity: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 10px" }}>Rogers Web Solutions · Anaheim, CA</p>
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
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.1em" }}>FOCUS · </span>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: C.text }}>{brief.focus}</span>
                </div>}
              </>
          }
        </>)}
        {card("0.24s", <>
          <Label>Tech Pulse</Label>
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
                {prepStatus === "running" ? `Pulling + enriching: ${todayNiche}` : "Leads enriched and auto-pipelined"}
              </p>
            </div>
            <Pill color={prepStatus === "done" ? C.green : C.amber}>{prepStatus === "done" ? "ready" : "working"}</Pill>
          </div>
        )}
      </div>

      <button onClick={onEnter} style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "14px 44px", borderRadius: 50, cursor: "pointer", background: `${C.green}14`, border: `1px solid ${C.green}55`, color: C.green, transition: "all 0.2s", animation: "fadeUp 0.5s ease both", animationDelay: "0.5s", opacity: 0 }}>
        {prepStatus === "done" ? "Enter — Leads Ready" : "Enter Command Center"}
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

// ─── EMAIL MODULE ─────────────────────────────────────────────────────────────
function EmailModule({ state, setState }) {
  const { triage = "", triaging = false, authError = false, ctx = "", draft = "", drafting = false } = state;

  async function pullInbox() {
    setState(s => ({ ...s, triaging: true, triage: "", authError: false }));
    const data = await fetchGmail();
    if (data.authorized === false) { setState(s => ({ ...s, triaging: false, authError: true })); return; }
    if (data.error) { setState(s => ({ ...s, triaging: false, triage: `Error: ${data.error}` })); return; }
    if (!data.emails?.length) { setState(s => ({ ...s, triaging: false, triage: "Inbox is clear — no unread messages." })); return; }

    const emailSummary = data.emails.map((e, i) => `${i + 1}. FROM: ${e.from}\nSUBJECT: ${e.subject}\nSNIPPET: ${e.snippet}`).join("\n\n");
    const result = await ai(RWS_CTX + `\n\nTriage this real inbox. For each: is it an RWS lead? Does it need a reply? Recommended action (reply / ignore / follow-up)? FORMAT: FROM / SUBJECT / SUMMARY / ACTION`, `${data.emails.length} unread emails:\n\n${emailSummary}`);
    setState(s => ({ ...s, triage: result, triaging: false }));
  }

  async function draftReply() {
    if (!ctx.trim()) return;
    setState(s => ({ ...s, drafting: true, draft: "" }));
    const d = await ai(RWS_CTX + `\n\nDraft a reply from trogers@rogers-websolutions.com. Direct, short, human. Lead inquiries get a quick value pitch + Calendly link. Sign: Trafton Rogers | RWS | trogers@rogers-websolutions.com`, ctx);
    setState(s => ({ ...s, draft: d, drafting: false }));
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.green} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Email</span>
        <Pill color={C.green} sm>Gmail</Pill>
      </div>
      <Label>Inbox Triage</Label>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <Btn onClick={pullInbox} loading={triaging} color={C.blue} sm>Pull Inbox</Btn>
      </div>
      {authError
        ? <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "13px 15px" }}>
            <p style={{ fontFamily: MONO, fontSize: 11, color: C.amber, margin: "0 0 8px" }}>Google not authorized.</p>
            <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Reconnect Gmail</a>
          </div>
        : <TextBox value={triage} loading={triaging} placeholder="Hit 'Pull Inbox' to fetch and triage your real Gmail." />
      }
      <Divider />
      <Label>Draft Reply</Label>
      <Field value={ctx} onChange={v => setState(s => ({ ...s, ctx: v }))} placeholder="Paste email or describe the situation" rows={3} />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Btn onClick={draftReply} loading={drafting} disabled={!ctx.trim()} color={C.green}>Draft Reply</Btn>
      </div>
      {(drafting || draft) && (
        <div style={{ marginTop: 12 }}>
          <TextBox value={draft} loading={drafting} placeholder="" />
          {draft && <div style={{ marginTop: 8 }}><CopyBtn text={draft} sm /></div>}
        </div>
      )}
    </Card>
  );
}

// ─── CALENDAR MODULE ──────────────────────────────────────────────────────────
function CalendarModule({ state, setState }) {
  const { summary = "", loading = false, authError = false } = state;

  async function pullWeek() {
    setState(s => ({ ...s, loading: true, summary: "", authError: false }));
    const data = await fetchCalendar(7);
    if (data.authorized === false) { setState(s => ({ ...s, loading: false, authError: true })); return; }
    if (data.error) { setState(s => ({ ...s, loading: false, summary: `Error: ${data.error}` })); return; }
    if (!data.events?.length) { setState(s => ({ ...s, loading: false, summary: "Week is clear — no events on Google Calendar." })); return; }

    const evtText = data.events.map(e => {
      const start = new Date(e.start);
      return `- ${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${e.allDay ? "(all day)" : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}: ${e.title}`;
    }).join("\n");

    const result = await ai(RWS_CTX + `\n\nReview Trafton's calendar. Flag anything during 8-5 M-F. Note evening/weekend slots for RWS calls. Clean day-by-day summary.`, `Events next 7 days:\n${evtText}`);
    setState(s => ({ ...s, summary: result, loading: false }));
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.blue} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Calendar</span>
        <Pill color={C.blue} sm>GCal</Pill>
      </div>
      <div style={{ marginBottom: 14 }}><Btn onClick={pullWeek} loading={loading} color={C.blue}>Pull This Week</Btn></div>
      {authError
        ? <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "13px 15px" }}>
            <p style={{ fontFamily: MONO, fontSize: 11, color: C.amber, margin: "0 0 8px" }}>Google not authorized.</p>
            <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Reconnect Google</a>
          </div>
        : <TextBox value={summary} loading={loading} placeholder="Pull your week — reads your real Google Calendar." />
      }
    </Card>
  );
}

// ─── SHARED: EDIT PANEL ───────────────────────────────────────────────────────
function EditPanel({ data, onChange, onSave, onCancel }) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "rgba(171,71,188,0.04)" }}>
      <Label>Edit Lead Data</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email</p>
          <input value={data.email} onChange={e => onChange(d => ({ ...d, email: e.target.value }))} placeholder="owner@business.com"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }} />
        </div>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>IG Handle</p>
          <input value={data.instagramHandle} onChange={e => {
            const handle = parseIgHandle(e.target.value);
            onChange(d => ({ ...d, instagramHandle: handle ? `@${handle}` : "", instagram: handle ? `https://www.instagram.com/${handle}/` : "" }));
          }} placeholder="@handle or paste URL"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }} />
        </div>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Website URL</p>
          <input value={data.website} onChange={e => onChange(d => ({ ...d, website: e.target.value }))} placeholder="https://..."
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }} />
        </div>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Website Type</p>
          <select value={data.websiteType} onChange={e => onChange(d => ({ ...d, websiteType: e.target.value, hasWebsite: e.target.value !== "none" && e.target.value !== "" }))}
            style={{ width: "100%", boxSizing: "border-box", background: "#0d0f14", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" }}>
            <option value="">None / Unknown</option>
            <option value="none">No website</option>
            <option value="link_in_bio">Link-in-bio (campsite, linktree, etc)</option>
            <option value="real">Real website</option>
            <option value="weak">Weak DIY site (Wix, GoDaddy, etc)</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontFamily: MONO, fontSize: 9, color: C.muted, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Notes (Claude uses these when writing copy)</p>
        <textarea value={data.notes} onChange={e => onChange(d => ({ ...d, notes: e.target.value }))}
          placeholder="e.g. Uses campsite.bio — active on IG, lots of reels, no real site" rows={2}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none", resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onSave} color={C.green} sm>Save Changes</Btn>
        <Btn onClick={onCancel} color={C.muted} sm>Cancel</Btn>
      </div>
    </div>
  );
}

// ─── SHARED: COPY PANEL ───────────────────────────────────────────────────────
function CopyPanel({ prospect, onSend }) {
  const [coldDraft,      setColdDraft]      = useState(null);
  const [coldGenerating, setColdGenerating] = useState(false);
  const [coldError,      setColdError]      = useState(null);
  const [coldExpanded,   setColdExpanded]   = useState(false);
  const [coldSending,    setColdSending]    = useState(false);
  const [coldSendResult, setColdSendResult] = useState(null);
  const [coldShowSend,   setColdShowSend]   = useState(false);

  const [fuDraft,      setFuDraft]      = useState(null);
  const [fuGenerating, setFuGenerating] = useState(false);
  const [fuError,      setFuError]      = useState(null);
  const [fuExpanded,   setFuExpanded]   = useState(false);
  const [fuSending,    setFuSending]    = useState(false);
  const [fuSendResult, setFuSendResult] = useState(null);
  const [fuShowSend,   setFuShowSend]   = useState(false);

  const [showPitchForm,  setShowPitchForm]  = useState(false);
  const [pitchDraft,     setPitchDraft]     = useState(null);
  const [pitchGenerating,setPitchGenerating]= useState(false);
  const [pitchError,     setPitchError]     = useState(null);
  const [pitchExpanded,  setPitchExpanded]  = useState(false);
  const [pitchSending,   setPitchSending]   = useState(false);
  const [pitchSendResult,setPitchSendResult]= useState(null);
  const [pitchShowSend,  setPitchShowSend]  = useState(false);
  const [pitchForm,      setPitchForm]      = useState({
    source:    "cold_dm",
    painPoint: "",
    package:   "care",
    timeline:  "flexible",
    notes:     "",
  });

  useEffect(() => {
    setColdDraft(null); setColdExpanded(false); setColdError(null);
    setFuDraft(null);   setFuExpanded(false);   setFuError(null);
    setPitchDraft(null);setPitchExpanded(false);setPitchError(null);
  }, [prospect.name, prospect.email, prospect.instagram, prospect.websiteType, prospect.website, prospect.hasWebsite, prospect.notes]);

  function buildLeadCtx() {
    const wType = prospect.websiteType;
    const wUrl  = prospect.website;
    const websiteCtx =
      wType === "link_in_bio" ? `Has a link-in-bio page (${wUrl}) — NOT a real website, no SEO presence`
      : wType === "weak"      ? `Has a weak DIY website (${wUrl}) — outdated builder site, poor SEO`
      : wType === "real"      ? `Has a real website: ${wUrl}`
      : wUrl                  ? `Has website: ${wUrl}`
      : "No website — completely invisible online";
    const contactInfo = [
      prospect.email     ? `Email: ${prospect.email}` : null,
      prospect.instagram ? `Instagram: ${prospect.instagram} (${prospect.instagramHandle})` : null,
      prospect.phone     ? `Phone: ${prospect.phone}` : null,
    ].filter(Boolean).join(" | ");
    return `Business: ${prospect.name} | City: ${prospect.city} | Category: ${prospect.category} | Rating: ${prospect.rating}★ | Reviews: ${prospect.reviews} | ${websiteCtx} | ${contactInfo}${prospect.notes ? ` | Notes: ${prospect.notes}` : ""}`;
  }

  async function generateCold() {
    if (coldDraft) { setColdExpanded(e => !e); return; }
    setColdGenerating(true); setColdError(null);
    try {
      const raw = await ai(
        RWS_CTX + `\n\nWrite an IG DM and cold email for this REAL business. Return ONLY valid JSON, no backticks:
{"dm":"3-4 sentences. Casual Instagram DM. Reference real rating and review count. Be precise about web presence. Close with rogers-websolutions.com/book. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com","emailSubject":"Subject using their real data points","emailBody":"Cold email. Open with their real numbers. 3-4 short paragraphs. Close: rogers-websolutions.com/book. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com"}`,
        buildLeadCtx()
      );
      if (raw.startsWith("Error:")) { setColdError(raw); }
      else {
        try { setColdDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setColdDraft({ dm: raw, emailSubject: `${prospect.name} — ${prospect.reviews} reviews`, emailBody: raw }); }
        setColdExpanded(true);
      }
    } catch (e) { setColdError(`Error: ${e.message}`); }
    setColdGenerating(false);
  }

  async function sendCold() {
    if (!prospect.email || !coldDraft) return;
    setColdSending(true); setColdSendResult(null);
    const result = await sendEmail(prospect.email, coldDraft.emailSubject, coldDraft.emailBody);
    setColdSending(false);
    if (result.success) { setColdSendResult("sent"); logOutreach("emails"); if (onSend) onSend(); }
    else { setColdSendResult(result.error || "unknown error"); }
  }

  async function generateFollowUp() {
    if (fuDraft) { setFuExpanded(e => !e); return; }
    setFuGenerating(true); setFuError(null);
    const bumpNum   = prospect.status === "followup" ? "second" : "first";
    const daysSince = prospect.contactedAt
      ? Math.floor((Date.now() - new Date(prospect.contactedAt).getTime()) / 86400000)
      : null;
    const timingCtx = daysSince !== null ? `${daysSince} days since last contact` : "timing unknown";
    try {
      const raw = await ai(
        RWS_CTX + `\n\nWrite a follow-up IG DM and follow-up email. This is the ${bumpNum} follow-up — ${timingCtx}. They haven't replied. Tone rules: genuinely casual, one soft touch, no urgency language, no repeating the pain point twice, no filler openers like "no worries if you've been busy". Reference their situation once, briefly. Leave the door open. Return ONLY valid JSON, no backticks:
{"dm":"2 sentences max. Mention you reached out, leave it open. No pressure language. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com","emailSubject":"Short low-key subject — not salesy","emailBody":"3 short paragraphs max. First: brief callback to the original outreach, one sentence. Second: one specific observation about their business — not repeated urgency. Third: soft CTA to rogers-websolutions.com/book, no pressure. NEVER use phrases like: lost bookings every day, you are missing out, most clients search online first, no worries if you have been busy. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com"}`,
        buildLeadCtx() + ` | Follow-up: ${bumpNum} bump | ${timingCtx}`
      );
      if (raw.startsWith("Error:")) { setFuError(raw); }
      else {
        try { setFuDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setFuDraft({ dm: raw, emailSubject: `Following up — ${prospect.name}`, emailBody: raw }); }
        setFuExpanded(true);
      }
    } catch (e) { setFuError(`Error: ${e.message}`); }
    setFuGenerating(false);
  }

  async function sendFollowUp() {
    if (!prospect.email || !fuDraft) return;
    setFuSending(true); setFuSendResult(null);
    const result = await sendEmail(prospect.email, fuDraft.emailSubject, fuDraft.emailBody);
    setFuSending(false);
    if (result.success) { setFuSendResult("sent"); logOutreach("emails"); if (onSend) onSend(); }
    else { setFuSendResult(result.error || "unknown error"); }
  }

  const PACKAGES = {
    starter: "Starter Site — $500 one-time (up to 4 pages, ~1 week)",
    care:    "Site + Care — $750 build + $200/mo (hosting, maintenance, unlimited edits)",
    custom:  "Custom scope (discuss on call)",
  };
  const SOURCES  = { cold_dm: "Cold DM", cold_email: "Cold Email", referral: "Referral", inbound: "Inbound inquiry" };
  const TIMELINES = { flexible: "Flexible", month: "Within a month", asap: "ASAP" };

  async function generatePitch() {
    if (pitchDraft) { setPitchExpanded(e => !e); return; }
    if (!pitchForm.painPoint.trim()) return;
    setPitchGenerating(true); setPitchError(null);
    try {
      const raw = await ai(
        RWS_CTX + `\n\nCreate a tailored pitch for this lead. Return ONLY valid JSON, no backticks:
{"talkingPoints":"4-6 bullet points as a single string, each on its own line starting with •. Specific to their situation. Reference their actual numbers. Map their pain point to RWS's solution. Include the package and pricing naturally. Conversational — these are call talking points, not a formal doc.","emailSubject":"Proposal email subject line — specific to them","emailBody":"Proposal email. Open by referencing how you connected. 3-4 paragraphs. Address their specific pain point. Pitch the package with pricing. Close with a soft CTA to book at rogers-websolutions.com/book. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com"}`,
        buildLeadCtx() + ` | How they came in: ${SOURCES[pitchForm.source]} | Pain point: ${pitchForm.painPoint} | Package to pitch: ${PACKAGES[pitchForm.package]} | Timeline: ${TIMELINES[pitchForm.timeline]}${pitchForm.notes ? ` | Additional context: ${pitchForm.notes}` : ""}`
      );
      if (raw.startsWith("Error:")) { setPitchError(raw); }
      else {
        try { setPitchDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setPitchDraft({ talkingPoints: raw, emailSubject: `Proposal — ${prospect.name}`, emailBody: raw }); }
        setPitchExpanded(true);
        setShowPitchForm(false);
      }
    } catch (e) { setPitchError(`Error: ${e.message}`); }
    setPitchGenerating(false);
  }

  async function sendPitch() {
    if (!prospect.email || !pitchDraft) return;
    setPitchSending(true); setPitchSendResult(null);
    const result = await sendEmail(prospect.email, pitchDraft.emailSubject, pitchDraft.emailBody);
    setPitchSending(false);
    if (result.success) { setPitchSendResult("sent"); logOutreach("emails"); if (onSend) onSend(); }
    else { setPitchSendResult(result.error || "unknown error"); }
  }

  function SendBlock({ draft, showSend, setShowSend, sending, onSend: handleSend, sendResult }) {
    if (!showSend) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", paddingTop: 1 }}>SUBJECT</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber, lineHeight: 1.5, wordBreak: "break-word" }}>{draft?.emailSubject}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${C.green}08`, borderRadius: 8, border: `1px solid ${C.green}20`, marginBottom: 8 }}>
          <Dot color={C.green} size={5} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>To: {prospect.email}</span>
        </div>
        <Btn onClick={handleSend} loading={sending} color={C.green}>Send from trogers@rogers-websolutions.com</Btn>
        {sendResult === "sent" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.green, margin: "8px 0 0" }}>Sent</p>}
        {sendResult && sendResult !== "sent" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "8px 0 0" }}>Send failed: {sendResult}</p>}
      </div>
    );
  }

  const selectStyle = { width: "100%", boxSizing: "border-box", background: "#0d0f14", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" };
  const inputStyle  = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "7px 10px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" };
  const microLabel  = { fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 4 };

  const showFuBtn = ["contacted","followup","warm"].includes(prospect.status);

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: (coldExpanded || fuExpanded || showPitchForm || pitchExpanded) ? 14 : 0 }}>
        <Btn onClick={generateCold} loading={coldGenerating} color={C.amber} sm>
          {coldDraft ? (coldExpanded ? "Hide Copy" : "Show Copy") : "Get Copy"}
        </Btn>
        {showFuBtn && (
          <Btn onClick={generateFollowUp} loading={fuGenerating} color={C.blue} sm>
            {fuDraft ? (fuExpanded ? "Hide Follow-up" : "Show Follow-up") : "Follow-up Copy"}
          </Btn>
        )}
        <Btn onClick={() => { setShowPitchForm(f => !f); if (pitchDraft) setPitchExpanded(false); }} color={C.green} sm>
          {showPitchForm ? "Cancel Pitch" : pitchDraft ? "Edit Pitch" : "Create Pitch"}
        </Btn>
        {(coldError || fuError || pitchError) && (
          <Btn onClick={() => { setColdError(null); setFuError(null); setPitchError(null); }} color={C.red} sm>Clear Errors</Btn>
        )}
      </div>

      {coldError && <div style={{ marginBottom: 8, padding: "8px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}><span style={{ fontFamily: MONO, fontSize: 11, color: C.red }}>{coldError}</span></div>}
      {fuError   && <div style={{ marginBottom: 8, padding: "8px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}><span style={{ fontFamily: MONO, fontSize: 11, color: C.red }}>{fuError}</span></div>}
      {pitchError && <div style={{ marginBottom: 8, padding: "8px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}><span style={{ fontFamily: MONO, fontSize: 11, color: C.red }}>{pitchError}</span></div>}

      {coldExpanded && coldDraft && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Dot color={C.amber} size={5} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cold Outreach</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>IG DM</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={coldDraft.dm} label="Copy DM" sm onCopy={() => logOutreach("dms")} />
                {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.purple}45`, textDecoration: "none", background: `${C.purple}12` }}>Open IG</a>}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{coldDraft.dm}</div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Cold Email</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CopyBtn text={`Subject: ${coldDraft.emailSubject}\n\n${coldDraft.emailBody}`} label="Copy" sm />
                {prospect.email
                  ? <Btn onClick={() => setColdShowSend(f => !f)} color={C.green} sm>{coldShowSend ? "Cancel" : "Send via Gmail"}</Btn>
                  : <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Add email to send</span>
                }
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {coldDraft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{coldDraft.emailBody}</div>
            {prospect.email && <SendBlock draft={coldDraft} showSend={coldShowSend} setShowSend={setColdShowSend} sending={coldSending} onSend={sendCold} sendResult={coldSendResult} />}
          </div>
        </div>
      )}

      {fuExpanded && fuDraft && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Dot color={C.blue} size={5} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.blue, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Follow-up — {prospect.status === "followup" ? "2nd Bump" : "1st Bump"}
              {prospect.contactedAt && ` · ${Math.floor((Date.now() - new Date(prospect.contactedAt).getTime()) / 86400000)}d since contact`}
            </span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Follow-up DM</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={fuDraft.dm} label="Copy DM" sm onCopy={() => logOutreach("dms")} />
                {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.purple}45`, textDecoration: "none", background: `${C.purple}12` }}>Open IG</a>}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{fuDraft.dm}</div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Follow-up Email</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CopyBtn text={`Subject: ${fuDraft.emailSubject}\n\n${fuDraft.emailBody}`} label="Copy" sm />
                {prospect.email
                  ? <Btn onClick={() => setFuShowSend(f => !f)} color={C.green} sm>{fuShowSend ? "Cancel" : "Send via Gmail"}</Btn>
                  : <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Add email to send</span>
                }
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {fuDraft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{fuDraft.emailBody}</div>
            {prospect.email && <SendBlock draft={fuDraft} showSend={fuShowSend} setShowSend={setFuShowSend} sending={fuSending} onSend={sendFollowUp} sendResult={fuSendResult} />}
          </div>
        </div>
      )}

      {showPitchForm && (
        <div style={{ marginBottom: 16, background: `${C.green}06`, border: `1px solid ${C.green}20`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Dot color={C.green} size={5} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.1em", textTransform: "uppercase" }}>Create Pitch — {prospect.name}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={microLabel}>How they came in</label>
              <select value={pitchForm.source} onChange={e => setPitchForm(f => ({ ...f, source: e.target.value }))} style={selectStyle}>
                <option value="cold_dm">Cold DM</option>
                <option value="cold_email">Cold Email</option>
                <option value="referral">Referral</option>
                <option value="inbound">Inbound inquiry</option>
              </select>
            </div>
            <div>
              <label style={microLabel}>Package to pitch</label>
              <select value={pitchForm.package} onChange={e => setPitchForm(f => ({ ...f, package: e.target.value }))} style={selectStyle}>
                <option value="starter">Starter — $500</option>
                <option value="care">Site + Care — $750 + $200/mo</option>
                <option value="custom">Custom scope</option>
              </select>
            </div>
            <div>
              <label style={microLabel}>Timeline urgency</label>
              <select value={pitchForm.timeline} onChange={e => setPitchForm(f => ({ ...f, timeline: e.target.value }))} style={selectStyle}>
                <option value="flexible">Flexible</option>
                <option value="month">Within a month</option>
                <option value="asap">ASAP</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={microLabel}>Pain point identified *</label>
            <textarea value={pitchForm.painPoint} onChange={e => setPitchForm(f => ({ ...f, painPoint: e.target.value }))}
              placeholder="e.g. Losing bookings to competitors with websites, all traffic goes to Yelp" rows={2}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={microLabel}>Additional notes</label>
            <textarea value={pitchForm.notes} onChange={e => setPitchForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Anything else Claude should know — their goals, objections, what they liked" rows={2}
              style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <Btn onClick={generatePitch} loading={pitchGenerating} disabled={!pitchForm.painPoint.trim()} color={C.green}>
            Generate Pitch
          </Btn>
        </div>
      )}

      {pitchExpanded && pitchDraft && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Dot color={C.green} size={5} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pitch — {prospect.name}</span>
            <Btn onClick={() => { setPitchExpanded(false); setShowPitchForm(true); }} color={C.muted} sm>Regenerate</Btn>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Talking Points</Label>
              <CopyBtn text={pitchDraft.talkingPoints} label="Copy" sm />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.85, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.green}20`, whiteSpace: "pre-wrap" }}>{pitchDraft.talkingPoints}</div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Proposal Email</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CopyBtn text={`Subject: ${pitchDraft.emailSubject}\n\n${pitchDraft.emailBody}`} label="Copy" sm />
                {prospect.email
                  ? <Btn onClick={() => setPitchShowSend(f => !f)} color={C.green} sm>{pitchShowSend ? "Cancel" : "Send via Gmail"}</Btn>
                  : <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Add email to send</span>
                }
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {pitchDraft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{pitchDraft.emailBody}</div>
            {prospect.email && <SendBlock draft={pitchDraft} showSend={pitchShowSend} setShowSend={setPitchShowSend} sending={pitchSending} onSend={sendPitch} sendResult={pitchSendResult} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEAD CARD ────────────────────────────────────────────────────────────────
function LeadCard({ prospect: initialProspect, onAdd, inPipeline, onDismiss }) {
  const [prospect,  setProspect]  = useState(initialProspect);
  const [editing,   setEditing]   = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [editData,  setEditData]  = useState({
    email:           prospect.email || "",
    instagram:       prospect.instagram || "",
    instagramHandle: prospect.instagramHandle || "",
    website:         prospect.website || "",
    hasWebsite:      prospect.hasWebsite ?? false,
    websiteType:     prospect.websiteType || "",
    notes:           prospect.notes || "",
  });

  const gc         = GRADE_COLOR[resolvedGrade(prospect)] || C.muted;
  const isEnriched = !!(prospect.email || prospect.instagram);
  const effectiveGrade = resolvedGrade(prospect);

  async function handleEnrich() {
    setEnriching(true);
    try {
      const result = await enrichLead(prospect);
      if (result && !result.error) {
        setProspect(p => ({
          ...p,
          email:           result.email || p.email || null,
          instagram:       result.instagram || p.instagram || null,
          instagramHandle: result.instagramHandle || p.instagramHandle || null,
          websiteType:     result.websiteType || p.websiteType || null,
          ownerName:       result.ownerName || p.ownerName || null,
          enriched:        true,
        }));
        setEditData(d => ({
          ...d,
          email:           result.email || d.email,
          instagram:       result.instagram || d.instagram,
          instagramHandle: result.instagramHandle || d.instagramHandle,
          websiteType:     result.websiteType || d.websiteType,
        }));
      }
    } catch (e) { console.error("Enrich failed:", e); }
    setEnriching(false);
  }

  function saveEdit() {
    setProspect(p => ({
      ...p,
      email:           editData.email.trim() || null,
      instagram:       editData.instagram.trim() || null,
      instagramHandle: editData.instagramHandle.trim() || null,
      website:         editData.website.trim() || null,
      hasWebsite:      editData.hasWebsite,
      websiteType:     editData.websiteType,
      notes:           editData.notes.trim(),
      enriched:        !!(editData.email || editData.instagram),
      manuallyEdited:  true,
    }));
    setEditing(false);
  }

  return (
    <div style={{ background: C.cardHi, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.text }}>{prospect.name}</span>
            <Pill color={gc} sm>Grade {effectiveGrade}</Pill>
            {effectiveGrade !== prospect.grade && <Pill color={C.muted} sm>Phone only</Pill>}
            {prospect.websiteType === "link_in_bio" && <Pill color={C.amber} sm>Link-in-bio</Pill>}
            {!prospect.hasWebsite && prospect.websiteType !== "link_in_bio" && <Pill color={C.green} sm>No website</Pill>}
            {isEnriched && <Pill color={C.blue} sm>Enriched</Pill>}
            {prospect.manuallyEdited && <Pill color={C.purple} sm>Edited</Pill>}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: "0 0 4px" }}>{prospect.address}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 3 }}>
            {prospect.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {prospect.rating} ({prospect.reviews})</span>}
            {prospect.phone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>{prospect.phone}</span>}
            <a href={prospect.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Maps</a>
            {prospect.website && <a href={prospect.website} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.sub, textDecoration: "none" }}>{prospect.websiteType === "link_in_bio" ? "Link-in-bio" : "Website"}</a>}
            {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.purple, textDecoration: "none" }}>{prospect.instagramHandle || "Instagram"}</a>}
            {prospect.email && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>{prospect.email}</span>}
          </div>
          {prospect.notes && <p style={{ fontFamily: MONO, fontSize: 10, color: C.sub, margin: "3px 0 0", fontStyle: "italic" }}>{prospect.notes}</p>}
          <p style={{ fontFamily: MONO, fontSize: 10, color: gc, margin: "3px 0 0" }}>{prospect.gradeReason}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Btn onClick={() => onAdd(prospect)} disabled={inPipeline} color={inPipeline ? C.purple : C.green} sm>{inPipeline ? "Added" : "+ Pipeline"}</Btn>
          <Btn onClick={handleEnrich} loading={enriching} color={C.blue} sm>{isEnriched ? "Re-enrich" : "Enrich"}</Btn>
          <Btn onClick={() => setEditing(e => !e)} color={C.purple} sm>{editing ? "Cancel" : "Edit"}</Btn>
          <Btn onClick={() => onDismiss(prospect.name)} color={C.red} sm>Not a Fit</Btn>
        </div>
      </div>
      {editing && <EditPanel data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditing(false)} />}
    </div>
  );
}

// ─── PIPELINE CARD ────────────────────────────────────────────────────────────
function PipelineCard({ lead, onUpdate, onRemove, onStatusChange }) {
  const [editing,   setEditing]   = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [editData,  setEditData]  = useState({
    email:           lead.email || "",
    instagram:       lead.instagram || "",
    instagramHandle: lead.instagramHandle || "",
    website:         lead.website || "",
    hasWebsite:      lead.hasWebsite ?? false,
    websiteType:     lead.websiteType || "",
    notes:           lead.notes || "",
  });

  useEffect(() => {
    setEditData({
      email:           lead.email || "",
      instagram:       lead.instagram || "",
      instagramHandle: lead.instagramHandle || "",
      website:         lead.website || "",
      hasWebsite:      lead.hasWebsite ?? false,
      websiteType:     lead.websiteType || "",
      notes:           lead.notes || "",
    });
  }, [lead.id]);

  const s  = STATUS[lead.status];
  const fu = followUpStatus(lead);
  const gc = GRADE_COLOR[resolvedGrade(lead)] || C.muted;

  const liveLead = {
    ...lead,
    email:           editData.email.trim() || lead.email || null,
    instagram:       editData.instagram.trim() || lead.instagram || null,
    instagramHandle: editData.instagramHandle.trim() || lead.instagramHandle || null,
    notes:           editData.notes.trim() || lead.notes || null,
    websiteType:     editData.websiteType || lead.websiteType || null,
    hasWebsite:      editData.hasWebsite ?? lead.hasWebsite,
  };

  async function handleEnrich() {
    setEnriching(true);
    try {
      const result = await enrichLead(lead);
      if (result && !result.error) {
        const patch = {
          email:           result.email || lead.email || null,
          instagram:       result.instagram || lead.instagram || null,
          instagramHandle: result.instagramHandle || lead.instagramHandle || null,
          websiteType:     result.websiteType || lead.websiteType || null,
          ownerName:       result.ownerName || lead.ownerName || null,
          enriched:        true,
        };
        onUpdate(lead.id, patch);
        setEditData(d => ({
          ...d,
          email:           patch.email || d.email,
          instagram:       patch.instagram || d.instagram,
          instagramHandle: patch.instagramHandle || d.instagramHandle,
          websiteType:     patch.websiteType || d.websiteType,
        }));
      }
    } catch (e) { console.error("Enrich failed:", e); }
    setEnriching(false);
  }

  function saveEdit() {
    const patch = {
      email:           editData.email.trim() || null,
      instagram:       editData.instagram.trim() || null,
      instagramHandle: editData.instagramHandle.trim() || null,
      website:         editData.website.trim() || null,
      hasWebsite:      editData.hasWebsite,
      websiteType:     editData.websiteType,
      notes:           editData.notes.trim(),
      enriched:        !!(editData.email || editData.instagram),
      manuallyEdited:  true,
    };
    onUpdate(lead.id, patch);
    setEditing(false);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${fu?.urgent ? C.amber + "50" : C.border2}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>{lead.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{lead.city}</span>
            {lead.grade && <Pill color={gc} sm>Grade {resolvedGrade(lead)}</Pill>}
            {resolvedGrade(lead) !== lead.grade && <Pill color={C.muted} sm>Phone only</Pill>}
            {lead.websiteType === "link_in_bio" && <Pill color={C.amber} sm>Link-in-bio</Pill>}
            {lead.source === "manual" && <Pill color={C.green} sm>Manual</Pill>}
            {lead.manuallyEdited && <Pill color={C.purple} sm>Edited</Pill>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 3 }}>
            {lead.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {lead.rating} ({lead.reviews} reviews)</span>}
            {lead.phone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>{lead.phone}</span>}
            {lead.email && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>{lead.email}</span>}
            {lead.mapsUrl && <a href={lead.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Maps</a>}
            {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.purple, textDecoration: "none" }}>{lead.instagramHandle || "Instagram"}</a>}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Added {lead.addedAt}</span>
            {lead.contactedAt && <span style={{ fontFamily: MONO, fontSize: 10, color: C.blue }}>Contacted {new Date(lead.contactedAt).toLocaleDateString()}</span>}
            {lead.outreachType && <Pill color={lead.outreachType === "dm" ? C.purple : C.green} sm>{lead.outreachType === "dm" ? "DM" : "Email"} sent</Pill>}
            {fu && <span style={{ fontFamily: MONO, fontSize: 10, color: fu.color }}>{fu.label}</span>}
          </div>
          {lead.notes && <p style={{ fontFamily: MONO, fontSize: 10, color: C.sub, margin: "4px 0 0", fontStyle: "italic" }}>{lead.notes}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          <Pill color={s.color}>{s.label}</Pill>
          <Btn onClick={handleEnrich} loading={enriching} color={C.blue} sm>{lead.enriched ? "Re-enrich" : "Enrich"}</Btn>
          <Btn onClick={() => setEditing(e => !e)} color={C.purple} sm>{editing ? "Cancel" : "Edit"}</Btn>
          <Btn onClick={() => onRemove(lead.id)} color={C.red} sm>Remove</Btn>
        </div>
      </div>

      <div style={{ padding: "0 18px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
        {Object.entries(STATUS).map(([id, st]) => {
          if (id === "contacted") return (
            <React.Fragment key={id}>
              <button onClick={() => onStatusChange(lead.id, "contacted", "dm")}
                style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === "contacted" ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === "contacted" ? st.color : C.border}`, color: lead.status === "contacted" ? st.color : C.muted }}>
                DM Sent
              </button>
              <button onClick={() => onStatusChange(lead.id, "contacted", "email")}
                style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === "contacted" ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === "contacted" ? st.color : C.border}`, color: lead.status === "contacted" ? st.color : C.muted }}>
                Email Sent
              </button>
            </React.Fragment>
          );
          if (id === "followup") return (
            <React.Fragment key={id}>
              <button onClick={() => onStatusChange(lead.id, "followup", "dm")}
                style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === "followup" ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === "followup" ? st.color : C.border}`, color: lead.status === "followup" ? st.color : C.muted }}>
                Follow-up DM
              </button>
              <button onClick={() => onStatusChange(lead.id, "followup", "email")}
                style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === "followup" ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === "followup" ? st.color : C.border}`, color: lead.status === "followup" ? st.color : C.muted }}>
                Follow-up Email
              </button>
            </React.Fragment>
          );
          return (
            <button key={id} onClick={() => onStatusChange(lead.id, id)}
              style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === id ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === id ? st.color : C.border}`, color: lead.status === id ? st.color : C.muted }}>
              {st.label}
            </button>
          );
        })}
      </div>

      {editing && <EditPanel data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditing(false)} />}
      <CopyPanel prospect={liveLead} onSend={() => onStatusChange(lead.id, "contacted")} />
    </div>
  );
}

// ─── ADD LEAD MODAL ───────────────────────────────────────────────────────────
function AddLeadModal({ onAdd, onClose }) {
  const EMPTY = {
    name: "", city: "", phone: "", category: "",
    email: "", instagramHandle: "", website: "", websiteType: "",
    grade: "B", notes: "",
  };
  const [form,      setForm]      = useState(EMPTY);
  const [enriching, setEnriching] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleEnrich() {
    if (!form.name.trim()) return;
    setEnriching(true);
    const result = await enrichLead({ name: form.name, city: form.city, category: form.category, phone: form.phone, website: form.website });
    if (result && !result.error) {
      setForm(f => ({
        ...f,
        email:           result.email           || f.email,
        instagramHandle: result.instagramHandle  || f.instagramHandle,
        website:         result.website          || f.website,
        websiteType:     result.websiteType      || f.websiteType,
        phone:           result.phone            || f.phone,
      }));
    }
    setEnriching(false);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    const raw   = parseIgHandle(form.instagramHandle);
    const entry = {
      id:              `${Date.now()}-${Math.random()}`,
      status:          "new",
      addedAt:         new Date().toLocaleDateString(),
      source:          "manual",
      name:            form.name.trim(),
      city:            form.city.trim(),
      phone:           form.phone.trim() || null,
      category:        form.category.trim(),
      email:           form.email.trim() || null,
      instagramHandle: raw ? `@${raw}` : null,
      instagram:       raw ? `https://www.instagram.com/${raw}/` : null,
      website:         form.website.trim() || null,
      websiteType:     form.websiteType || null,
      hasWebsite:      !!(form.websiteType && form.websiteType !== "none"),
      grade:           form.grade,
      notes:           form.notes.trim(),
      enriched:        !!(form.email || form.instagramHandle),
      rating:          0,
      reviews:         0,
    };
    onAdd(entry);
    onClose();
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 11px", fontFamily: MONO, fontSize: 11, color: C.text, outline: "none" };
  const labelStyle = { fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border2}`, borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dot color={C.green} size={7} />
            <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Add Lead Manually</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Business Info</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Business Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Luisa's Nail Studio" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Anaheim" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input value={form.category} onChange={e => set("category", e.target.value)} placeholder="nail salon" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(714) 555-0000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Grade</label>
              <select value={form.grade} onChange={e => set("grade", e.target.value)} style={{ ...inputStyle, background: "#0d0f14" }}>
                <option value="A">A — Perfect fit</option>
                <option value="B">B — Solid prospect</option>
                <option value="C">C — Redesign / care plan</option>
                <option value="D">D — Has a real site</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Contact Info</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="owner@business.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>IG Handle</label>
              <input value={form.instagramHandle} onChange={e => set("instagramHandle", e.target.value)} placeholder="@handle or paste URL" style={inputStyle} />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Web Presence</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Website URL</label>
              <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Website Type</label>
              <select value={form.websiteType} onChange={e => set("websiteType", e.target.value)} style={{ ...inputStyle, background: "#0d0f14" }}>
                <option value="">None / Unknown</option>
                <option value="none">No website</option>
                <option value="link_in_bio">Link-in-bio</option>
                <option value="weak">Weak DIY site</option>
                <option value="real">Real website</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="e.g. Found on IG, active with reels, no website link in bio" rows={2}
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={handleEnrich} loading={enriching} disabled={!form.name.trim()} color={C.blue} sm>Enrich</Btn>
          <Btn onClick={onClose} color={C.muted} sm>Cancel</Btn>
          <Btn onClick={handleSubmit} disabled={!form.name.trim()} color={C.green}>Add to Pipeline</Btn>
        </div>
      </div>
    </div>
  );
}

async function dismissLead(name) {
  try {
    await fetch("/api/dismissed", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "" },
      body: JSON.stringify({ name }),
    });
  } catch {}
}

async function loadDismissed() {
  try {
    const res = await fetch("/api/dismissed", { headers: { "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "" } });
    const d = await res.json();
    return new Set(d.dismissed || []);
  } catch { return new Set(); }
}

// ─── LEAD SCRAPER ─────────────────────────────────────────────────────────────
function LeadScraper({ state, setState, onAdd, pipelineNames, pipeline }) {
  const { niche = "", prospects = [], loading = false, error = "" } = state;
  const [dismissed,      setDismissed]      = useState(new Set());
  const [autoPipelining, setAutoPipelining] = useState(false);
  const [autoLog,        setAutoLog]        = useState([]);
  const [showAutoLog,    setShowAutoLog]    = useState(false);

  useEffect(() => { loadDismissed().then(setDismissed); }, []);

  async function search() {
    if (!niche.trim()) return;
    // ── FIX: clear previous results before loading new search ──
    setState(s => ({ ...s, loading: true, error: "", prospects: [] }));
    const data = await fetchLeads(niche);
    if (data.error) { setState(s => ({ ...s, loading: false, error: data.error })); return; }
    logNicheSearch(niche, data.aGrade || 0, data.bGrade || 0);
    const newProspects = data.prospects || [];
    setState(s => ({ ...s, loading: false, prospects: newProspects, lastSearch: niche }));

    const candidates = newProspects.filter(p =>
      (resolvedGrade(p) === "A" || resolvedGrade(p) === "B") && !pipelineNames.has(p.name)
    );
    if (candidates.length === 0) return;

    const currentDismissed = await loadDismissed();
    const eligible = candidates.filter(p => !currentDismissed.has(p.name));
    if (eligible.length === 0) return;

    setAutoLog([`Auto-enriching ${eligible.length} Grade A/B leads from search...`]);
    setShowAutoLog(true);
    setAutoPipelining(true);

    const log = [`Auto-enriching ${eligible.length} Grade A/B leads from search...`];
    let added = 0, skipped = 0;

    for (const prospect of eligible) {
      log.push(`Enriching ${prospect.name}...`);
      setAutoLog([...log]);
      const result   = await enrichLead(prospect);
      const enriched = { ...prospect, ...result, enriched: true };
      if (!!(enriched.email || enriched.instagram)) {
        onAdd(enriched);
        added++;
        log.push(`Added: ${prospect.name} (${enriched.email || enriched.instagramHandle || "IG"})`);
      } else {
        skipped++;
        log.push(`Skipped: ${prospect.name} — no contact found`);
      }
      setAutoLog([...log]);
    }

    log.push(`Done. ${added} added, ${skipped} skipped.`);
    setAutoLog([...log]);
    setAutoPipelining(false);
  }

  async function autoPipeline() {
    const visible    = prospects.filter(p => !dismissed.has(p.name));
    const candidates = visible.filter(p =>
      (resolvedGrade(p) === "A" || resolvedGrade(p) === "B") && !pipelineNames.has(p.name)
    );

    if (candidates.length === 0) {
      setAutoLog(["No Grade A or B leads available that aren't already in pipeline."]);
      setShowAutoLog(true);
      return;
    }

    setAutoPipelining(true);
    setAutoLog([`Found ${candidates.length} Grade A/B candidates. Enriching...`]);
    setShowAutoLog(true);

    let added = 0, skipped = 0;
    const log = [`Found ${candidates.length} Grade A/B candidates. Enriching...`];

    for (const prospect of candidates) {
      log.push(`Enriching ${prospect.name}...`);
      setAutoLog([...log]);
      const result   = await enrichLead(prospect);
      const enriched = { ...prospect, ...result, enriched: true };
      if (!!(enriched.email || enriched.instagram)) {
        onAdd(enriched);
        added++;
        log.push(`Added: ${prospect.name} (${enriched.email ? enriched.email : enriched.instagramHandle || "IG"})`);
      } else {
        skipped++;
        log.push(`Skipped: ${prospect.name} — no email or IG found`);
      }
      setAutoLog([...log]);
    }

    log.push(`Done. ${added} added to pipeline, ${skipped} skipped (no contact info).`);
    setAutoLog([...log]);
    setAutoPipelining(false);
  }

  function handleDismiss(name) {
    setDismissed(prev => new Set([...prev, name]));
    dismissLead(name);
    setState(s => ({ ...s, prospects: s.prospects.filter(p => p.name !== name) }));
  }

  const visible = prospects.filter(p => !dismissed.has(p.name));
  const aGrade  = visible.filter(p => resolvedGrade(p) === "A");
  const bGrade  = visible.filter(p => resolvedGrade(p) === "B");
  const cGrade  = visible.filter(p => resolvedGrade(p) === "C");
  const dGrade  = visible.filter(p => resolvedGrade(p) === "D");
  const noSite  = visible.filter(p => !p.hasWebsite);

  const autoCandidates = visible.filter(p =>
    (resolvedGrade(p) === "A" || resolvedGrade(p) === "B") && !pipelineNames.has(p.name)
  ).length;

  const gradeGroups = [
    { grade: "A", label: "Grade A — Perfect Fit",          color: C.green, items: aGrade },
    { grade: "B", label: "Grade B — Solid Prospect",       color: C.amber, items: bGrade },
    { grade: "C", label: "Grade C — Redesign / Care Plan", color: C.blue,  items: cGrade },
    { grade: "D", label: "Grade D — Lower Priority",       color: C.muted, items: dGrade },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Dot color={C.amber} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Lead Scraper</span>
          <Pill color={C.blue} sm>Google Maps · Real Data</Pill>
          {prospects.length > 0 && <Pill color={C.green} sm>{prospects.length} loaded</Pill>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field value={niche} onChange={v => setState(s => ({ ...s, niche: v }))} placeholder="e.g. lashes Orange County, HVAC Anaheim, plumbers Tustin" onKeyDown={e => e.key === "Enter" && search()} />
          <Btn onClick={search} loading={loading} disabled={!niche.trim()} color={C.amber}>Search</Btn>
        </div>
        {prospects.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button onClick={() => setState(s => ({ ...s, prospects: [] }))} style={{ fontFamily: MONO, fontSize: 10, background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>
              Clear all results
            </button>
            {autoCandidates > 0 && (
              <Btn onClick={autoPipeline} loading={autoPipelining} color={C.green} sm>
                Auto-enrich &amp; Pipeline ({autoCandidates} A/B leads)
              </Btn>
            )}
          </div>
        )}
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "10px 0 0" }}>Error: {error}</p>}
      </Card>

      {showAutoLog && autoLog.length > 0 && (
        <Card style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Label>Auto-pipeline Log</Label>
            {!autoPipelining && (
              <button onClick={() => setShowAutoLog(false)} style={{ fontFamily: MONO, fontSize: 10, background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}>
                Dismiss
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {autoLog.map((line, i) => {
              const isAdded   = line.startsWith("Added:");
              const isSkipped = line.startsWith("Skipped:");
              const isDone    = line.startsWith("Done.");
              const color     = isAdded ? C.green : isSkipped ? C.muted : isDone ? C.amber : C.sub;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {autoPipelining && i === autoLog.length - 1 && !isDone
                    ? <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, animation: "blink 0.9s step-start infinite" }}>→</span>
                    : <span style={{ fontFamily: MONO, fontSize: 10, color, flexShrink: 0 }}>{isAdded ? "✓" : isSkipped ? "—" : isDone ? "●" : "·"}</span>
                  }
                  <span style={{ fontFamily: MONO, fontSize: 11, color }}>{line}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {loading && <Card><p style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Pulling real businesses from Google Maps...</span></p></Card>}

      {!loading && visible.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {[
              { label: "Total",   val: visible.length, color: C.sub   },
              { label: "No Site", val: noSite.length,  color: C.green },
              { label: "Grade A", val: aGrade.length,  color: C.green },
              { label: "Grade B", val: bGrade.length,  color: C.amber },
              { label: "Grade C", val: cGrade.length,  color: C.blue  },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: s.color, marginBottom: 2 }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {gradeGroups.map(g => (
            <div key={g.grade}>
              <div style={{ marginBottom: 10 }}><Pill color={g.color}>{g.label}</Pill></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map((p, i) => (
                  <LeadCard key={`${p.name}-${i}`} prospect={p} onAdd={onAdd} inPipeline={pipelineNames.has(p.name)} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && visible.length === 0 && prospects.length > 0 && (
        <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>All results dismissed — search a new niche or clear results.</p></Card>
      )}
      {!loading && prospects.length === 0 && niche && !error && (
        <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No results yet — hit Search to pull real businesses from Google Maps.</p></Card>
      )}
    </div>
  );
}

// ─── OUTREACH MODULE ──────────────────────────────────────────────────────────
function OutreachModule({ state, setState, pipeline }) {
  const { selected = null, type = "cold", output = "", loading = false, custom = "" } = state;

  const types = [
    { id: "cold",     label: "Cold Email" },
    { id: "dm",       label: "IG DM"      },
    { id: "followup", label: "Follow-up"  },
    { id: "warm",     label: "Warm Close" },
  ];

  async function generate() {
    const target = selected
      ? `Business: ${selected.name} | City: ${selected.city} | Rating: ${selected.rating} stars | Reviews: ${selected.reviews} | Has website: ${selected.hasWebsite}${selected.email ? ` | Email: ${selected.email}` : ""}${selected.instagram ? ` | Instagram: ${selected.instagram}` : ""}`
      : custom;
    if (!target.trim()) return;
    setState(s => ({ ...s, loading: true, output: "" }));
    const prompts = {
      cold:     "Write a cold outreach EMAIL with Subject: line. Use their real data. Human, value-first, Calendly close. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com",
      dm:       "Write a cold Instagram DM. 3-4 sentences. References real data. Soft rogers-websolutions.com/book close. No em-dashes. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com",
      followup: "Write a follow-up email. No reply to first outreach. Brief, no pressure, specific re-pitch. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com",
      warm:     "Write a closing email. They showed interest. Move them to book on rogers-websolutions.com/book. Confident and short. REQUIRED — last line must be exactly this, no exceptions: Trafton Rogers | RWS | trogers@rogers-websolutions.com",
    };
    const result = await ai(RWS_CTX + `\n\n${prompts[type]}`, target);
    setState(s => ({ ...s, output: result, loading: false }));
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.purple} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Outreach</span>
        <Pill color={C.purple} sm>AI Copy</Pill>
      </div>
      <Label>Target</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {pipeline.slice(0, 6).map(lead => (
          <button key={lead.id} onClick={() => setState(s => ({ ...s, selected: lead, output: "" }))}
            style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: selected?.id === lead.id ? `${C.purple}18` : "transparent", border: `1px solid ${selected?.id === lead.id ? C.purple : C.border}`, color: selected?.id === lead.id ? C.purple : C.muted }}>
            {lead.name}
          </button>
        ))}
      </div>
      {!selected && (
        <>
          <Label>Or describe manually</Label>
          <Field value={custom} onChange={v => setState(s => ({ ...s, custom: v }))} placeholder="Business name, city, rating, website status..." rows={2} />
        </>
      )}
      {selected && (
        <div style={{ background: `${C.purple}08`, borderRadius: 8, border: `1px solid ${C.purple}20`, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>{selected.name}</span>
            <button onClick={() => setState(s => ({ ...s, selected: null, output: "" }))} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 11 }}>clear</button>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{selected.city} · {selected.rating}★ · {selected.reviews} reviews</span>
        </div>
      )}
      <Divider />
      <Label>Copy Type</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {types.map(t => (
          <button key={t.id} onClick={() => setState(s => ({ ...s, type: t.id, output: "" }))}
            style={{ fontFamily: MONO, fontSize: 10, padding: "5px 14px", borderRadius: 20, cursor: "pointer", background: type === t.id ? `${C.purple}18` : "transparent", border: `1px solid ${type === t.id ? C.purple : C.border}`, color: type === t.id ? C.purple : C.muted }}>
            {t.label}
          </button>
        ))}
      </div>
      <Btn onClick={generate} loading={loading} disabled={!selected && !custom.trim()} color={C.purple}>Generate Copy</Btn>
      {(loading || output) && (
        <div style={{ marginTop: 16 }}>
          <TextBox value={output} loading={loading} placeholder="" />
          {output && <div style={{ marginTop: 8 }}><CopyBtn text={output} sm /></div>}
        </div>
      )}
    </Card>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
const ANALYTICS_KEY = "rws_analytics_v1";

function loadAnalytics() {
  try { return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || "{}"); } catch { return {}; }
}
function saveAnalytics(data) {
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data)); } catch {}
}

function logNicheSearch(niche, aCount, bCount) {
  const data   = loadAnalytics();
  const today  = new Date().toISOString().split("T")[0];
  if (!data.searches) data.searches = [];
  data.searches.push({ date: today, niche, aCount, bCount });
  if (data.searches.length > 200) data.searches = data.searches.slice(-200);
  saveAnalytics(data);
}

function logOutreach(type) {
  const data  = loadAnalytics();
  const today = new Date().toISOString().split("T")[0];
  if (!data.outreach) data.outreach = {};
  if (!data.outreach[today]) data.outreach[today] = { dms: 0, emails: 0 };
  if (type === "dms")    data.outreach[today].dms++;
  if (type === "emails") data.outreach[today].emails++;
  saveAnalytics(data);
}

function AnalyticsModule({ pipeline }) {
  const [data, setData] = useState({});

  useEffect(() => { setData(loadAnalytics()); }, []);

  const searches = data.searches || [];
  const outreach = data.outreach || {};

  const recentSearches = searches.slice(-10).reverse();
  const last7          = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    return { date: key, label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), dms: outreach[key]?.dms || 0, emails: outreach[key]?.emails || 0 };
  }).reverse();

  const totalDms    = last7.reduce((a, d) => a + d.dms, 0);
  const totalEmails = last7.reduce((a, d) => a + d.emails, 0);

  const statusCounts = pipeline.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Pipeline",     val: pipeline.length,  color: C.green  },
          { label: "DMs (7d)",     val: totalDms,         color: C.purple },
          { label: "Emails (7d)",  val: totalEmails,      color: C.blue   },
        ].map(s => (
          <Card key={s.label} style={{ padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 500, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <Label>Outreach — Last 7 Days</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {last7.map(d => (
            <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, width: 90, flexShrink: 0 }}>{d.label}</span>
              <div style={{ flex: 1, display: "flex", gap: 6 }}>
                {d.dms > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: C.purple, background: `${C.purple}12`, borderRadius: 4, padding: "2px 8px" }}>{d.dms} DM{d.dms !== 1 ? "s" : ""}</span>}
                {d.emails > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: C.blue, background: `${C.blue}12`, borderRadius: 4, padding: "2px 8px" }}>{d.emails} email{d.emails !== 1 ? "s" : ""}</span>}
                {d.dms === 0 && d.emails === 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.1)" }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Pipeline by Status</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(STATUS).map(([id, st]) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, background: `${st.color}08`, border: `1px solid ${st.color}20`, borderRadius: 8, padding: "6px 12px" }}>
              <Dot color={st.color} size={5} />
              <span style={{ fontFamily: MONO, fontSize: 11, color: st.color }}>{st.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: C.text, fontWeight: 500 }}>{statusCounts[id] || 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Recent Searches</Label>
        {recentSearches.length === 0
          ? <p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>No searches yet.</p>
          : <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {recentSearches.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, width: 80, flexShrink: 0 }}>{s.date}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.text, flex: 1 }}>{s.niche}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.green }}>{s.aCount}A</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>{s.bCount}B</span>
                </div>
              ))}
            </div>
        }
      </Card>
    </div>
  );
}

// ─── FOLLOW-UP HELPER ─────────────────────────────────────────────────────────
function followUpStatus(lead) {
  if (!lead.contactedAt || !["contacted", "followup"].includes(lead.status)) return null;
  const days = Math.floor((Date.now() - new Date(lead.contactedAt).getTime()) / 86400000);
  if (lead.status === "contacted") {
    if (days >= 4)  return { label: `Follow-up due (${days}d)`, color: C.amber, urgent: days >= 6 };
    return { label: `${4 - days}d until follow-up`, color: C.muted, urgent: false };
  }
  if (lead.status === "followup") {
    if (days >= 8)  return { label: `2nd follow-up due (${days}d)`, color: C.red, urgent: true };
    return { label: `${8 - days}d until 2nd follow-up`, color: C.muted, urgent: false };
  }
  return null;
}

// ─── FOLLOW-UP BANNER ─────────────────────────────────────────────────────────
function FollowUpBanner({ pipeline, onTabSwitch }) {
  const due = pipeline.filter(l => {
    const fu = followUpStatus(l);
    return fu?.urgent;
  });
  if (due.length === 0) return null;
  return (
    <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Dot color={C.amber} pulse />
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>{due.length} lead{due.length !== 1 ? "s" : ""} need a follow-up</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {due.slice(0, 3).map(l => <Pill key={l.id} color={C.amber} sm>{l.name}</Pill>)}
          {due.length > 3 && <Pill color={C.muted} sm>+{due.length - 3} more</Pill>}
        </div>
      </div>
      <Btn onClick={() => onTabSwitch("pipeline")} color={C.amber} sm>Go to Pipeline</Btn>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [screen,   setScreen]   = useState("pin");
  const [tab,      setTab]      = useState("leads");
  const [pipeline, setPipeline] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [emailState,    setEmailState]    = useState({});
  const [calState,      setCalState]      = useState({});
  const [leadsState,    setLeadsState]    = useState({ niche: "", prospects: [] });
  const [outreachState, setOutreachState] = useState({ type: "cold", output: "", custom: "" });

  const pipelineNames = new Set(pipeline.map(l => l.name));

  function handlePrepReady({ prospects, niche, pipeline: prepPipeline }) {
    setLeadsState(s => ({ ...s, prospects, niche }));
    if (prepPipeline) setPipeline(prepPipeline);
  }

  useEffect(() => {
    if (screen === "app") loadPipeline().then(setPipeline);
  }, [screen]);

  function addToPipeline(prospect) {
    if (pipelineNames.has(prospect.name)) return;
    const entry = {
      id:      `${Date.now()}-${Math.random()}`,
      status:  "new",
      notes:   "",
      addedAt: new Date().toLocaleDateString(),
      ...prospect,
    };
    const updated = [...pipeline, entry];
    setPipeline(updated);
    savePipeline(updated);
  }

  function updateLead(id, patch) {
    const updated = pipeline.map(l => l.id === id ? { ...l, ...patch } : l);
    setPipeline(updated);
    savePipeline(updated);
  }

  function removeLead(id) {
    const updated = pipeline.filter(l => l.id !== id);
    setPipeline(updated);
    savePipeline(updated);
  }

  function statusChange(id, status, outreachType) {
    const updated = pipeline.map(l => {
      if (l.id !== id) return l;
      const patch = { ...l, status };
      if (status === "contacted") {
        patch.contactedAt  = new Date().toISOString();
        patch.outreachType = outreachType || l.outreachType;
      }
      if (status === "followup" && outreachType) patch.outreachType = outreachType;
      return patch;
    });
    setPipeline(updated);
    savePipeline(updated);
  }

  const TABS = [
    { id: "leads",    label: "Leads"    },
    { id: "outreach", label: "Outreach" },
    { id: "pipeline", label: "Pipeline", badge: pipeline.length },
    { id: "analytics",label: "Analytics"},
  ];

  if (screen === "pin")   return <PinGate onUnlock={() => setScreen("login")} />;
  if (screen === "login") return <LoginScreen onEnter={() => setScreen("app")} onPrepReady={handlePrepReady} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: BODY }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Azeret+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, background: C.bg, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: SERIF, fontSize: 17, color: C.white, letterSpacing: "-0.01em" }}>RWS Command</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>· ops.rogers-websolutions.com</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot color={C.green} size={6} /><span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>AI</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot color={C.green} size={6} /><span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Pipeline</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "14px 16px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? C.amber : "transparent"}`, color: tab === t.id ? C.amber : C.muted, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7 }}>
            {t.label}
            {t.badge > 0 && <span style={{ fontFamily: MONO, fontSize: 9, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`, borderRadius: 10, padding: "1px 6px" }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
        <FollowUpBanner pipeline={pipeline} onTabSwitch={setTab} />

        {tab === "leads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={() => setShowAddModal(true)} color={C.green} sm>+ Add Lead Manually</Btn>
            </div>
            <LeadScraper state={leadsState} setState={setLeadsState} onAdd={addToPipeline} pipelineNames={pipelineNames} pipeline={pipeline} />
          </div>
        )}

        {tab === "outreach" && (
          <div style={{ display: "grid", gap: 20 }}>
            <EmailModule    state={emailState}    setState={setEmailState}    />
            <CalendarModule state={calState}      setState={setCalState}      />
            <OutreachModule state={outreachState} setState={setOutreachState} pipeline={pipeline} />
          </div>
        )}

        {tab === "pipeline" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pipeline.length === 0
              ? <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", margin: 0 }}>Pipeline is empty — add leads from the Leads tab.</p></Card>
              : pipeline.map(lead => (
                  <PipelineCard key={lead.id} lead={lead} onUpdate={updateLead} onRemove={removeLead} onStatusChange={statusChange} />
                ))
            }
          </div>
        )}

        {tab === "analytics" && <AnalyticsModule pipeline={pipeline} />}
      </div>

      {showAddModal && <AddLeadModal onAdd={lead => { addToPipeline(lead); }} onClose={() => setShowAddModal(false)} />}

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)}100%{box-shadow:0 0 0 12px rgba(0,230,118,0)}}
        *{box-sizing:border-box}
        button:hover:not(:disabled){opacity:0.8}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
        select option{background:#0d0f14}
      `}</style>
    </div>
  );
}
