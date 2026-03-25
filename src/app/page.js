"use client";
import { useState, useEffect, useCallback } from "react";

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
Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com

DM SIGN-OFF — always end DMs with this on its own line:
Trafton @ Rogers Web Solutions`;

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
  const res = await fetch("/api/gmail-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, body }),
  });
  return res.json();
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
  return <Btn onClick={copy} color={copied ? C.green : C.muted} sm={sm}>{copied ? "Copied" : label}</Btn>;
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
        const prospects = (data.prospects || []).filter(p => !p.hasWebsite).slice(0, 6);
        const enriched = await Promise.all(
          prospects.filter(p => p.grade === "A").slice(0, 3).map(async p => {
            const enrichment = await enrichLead(p);
            return { ...p, ...enrichment };
          })
        );
        const allProspects = prospects.map(p => {
          const e = enriched.find(e => e.name === p.name);
          return e || p;
        });
        onPrepReady({ prospects: allProspects, niche: todayNiche });
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
                {prepStatus === "running" ? `Pulling + enriching: ${todayNiche}` : "Leads enriched and ready"}
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
    const d = await ai(RWS_CTX + `\n\nDraft a reply from trogers@rogers-websolutions.com. Direct, short, human. Lead inquiries get a quick value pitch + Calendly link. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com`, ctx);
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
            const raw = e.target.value.replace(/^@/, "");
            onChange(d => ({ ...d, instagramHandle: raw ? `@${raw}` : "", instagram: raw ? `https://www.instagram.com/${raw}/` : "" }));
          }} placeholder="@handle"
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
  const [draft,      setDraft]      = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState(null);
  const [sending,    setSending]    = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showSend,   setShowSend]   = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  useEffect(() => {
    setDraft(null);
    setExpanded(false);
    setGenError(null);
  }, [prospect.name, prospect.email, prospect.instagram, prospect.websiteType, prospect.notes]);

  async function generate() {
    if (draft) { setExpanded(e => !e); return; }
    setGenerating(true);
    setGenError(null);

    const websiteCtx = prospect.hasWebsite
      ? prospect.websiteType === "link_in_bio"
        ? `Has a link-in-bio page (${prospect.website}) — NOT a real website`
        : prospect.websiteType === "weak"
          ? `Has a weak DIY website (${prospect.website}) — outdated or builder-made`
          : `Has website: ${prospect.website}`
      : "No website";

    const contactInfo = [
      prospect.email       ? `Email: ${prospect.email}` : null,
      prospect.instagram   ? `Instagram: ${prospect.instagram} (${prospect.instagramHandle})` : null,
      prospect.phone       ? `Phone: ${prospect.phone}` : null,
    ].filter(Boolean).join(" | ");

    try {
      const raw = await ai(
        RWS_CTX + `\n\nWrite an IG DM and cold email for this REAL business. Return ONLY valid JSON, no backticks:
{"dm":"3-4 sentences. Casual Instagram DM. Reference real rating and review count. Be precise about web presence — if link-in-bio say that, if weak site say that, if no site say that. Close with rogers-websolutions.com/book. Sound like a real person.","emailSubject":"Subject using their real data points","emailBody":"Cold email. Open with their real numbers. Address the exact web presence gap accurately. 3-4 short paragraphs. Close: rogers-websolutions.com/book. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com"}`,
        `Business: ${prospect.name} | City: ${prospect.city} | Category: ${prospect.category} | Rating: ${prospect.rating}★ | Reviews: ${prospect.reviews} | ${websiteCtx} | ${contactInfo}${prospect.notes ? ` | Context: ${prospect.notes}` : ""}`
      );

      if (raw.startsWith("Error:")) {
        setGenError(raw);
      } else {
        try { setDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
        catch { setDraft({ dm: raw, emailSubject: `${prospect.name} — ${prospect.reviews} reviews`, emailBody: raw }); }
        setExpanded(true);
      }
    } catch (e) {
      setGenError(`Error: ${e.message}`);
    }
    setGenerating(false);
  }

  async function handleSend() {
    if (!prospect.email || !draft) return;
    setSending(true); setSendResult(null);
    const result = await sendEmail(prospect.email, draft.emailSubject, draft.emailBody);
    setSendResult(result.success ? "sent" : "error");
    setSending(false);
    if (result.success) {
      logOutreach("emails");
      if (onSend) onSend();
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: expanded && draft ? 14 : 0 }}>
        <Btn onClick={generate} loading={generating} color={C.amber} sm>
          {draft ? (expanded ? "Hide Copy" : "Show Copy") : "Get Copy"}
        </Btn>
        {genError && (
          <Btn onClick={() => { setGenError(null); generate(); }} color={C.red} sm>Retry</Btn>
        )}
      </div>

      {genError && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.red }}>{genError} — hit Retry to try again</span>
        </div>
      )}

      {expanded && draft && (
        <>
          {/* IG DM */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>IG DM</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={draft.dm} label="Copy DM" sm onCopy={() => logOutreach("dms")} />
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

          {/* Cold Email */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Cold Email</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <CopyBtn text={`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`} label="Copy" sm />
                {prospect.email
                  ? <Btn onClick={() => setShowSend(f => !f)} color={C.green} sm>{showSend ? "Cancel" : "Send via Gmail"}</Btn>
                  : <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Add email in Edit to send</span>
                }
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {draft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.emailBody}</div>

            {/* Send form */}
            {showSend && prospect.email && (
              <div style={{ marginTop: 10 }}>

                {/* Subject preview — shows exactly what will land in their inbox */}
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  marginBottom: 8,
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", paddingTop: 1 }}>SUBJECT</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber, lineHeight: 1.5, wordBreak: "break-word" }}>{draft.emailSubject}</span>
                </div>

                {/* To line */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: `${C.green}08`,
                  borderRadius: 8,
                  border: `1px solid ${C.green}20`,
                  marginBottom: 8,
                }}>
                  <Dot color={C.green} size={5} />
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>To: {prospect.email}</span>
                </div>

                <Btn onClick={handleSend} loading={sending} color={C.green}>Send from trogers@rogers-websolutions.com</Btn>
              </div>
            )}

            {sendResult === "sent"  && <p style={{ fontFamily: MONO, fontSize: 11, color: C.green, margin: "8px 0 0" }}>Sent</p>}
            {sendResult === "error" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red,   margin: "8px 0 0" }}>Send failed — check Gmail auth</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── LEAD CARD (Leads tab — triage only, no copy) ─────────────────────────────
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

  const gc         = GRADE_COLOR[prospect.grade] || C.muted;
  const isEnriched = !!(prospect.email || prospect.instagram);

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
    } catch (e) {
      console.error("Enrich failed:", e);
    }
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
            <Pill color={gc} sm>Grade {prospect.grade}</Pill>
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

// ─── PIPELINE CARD (Pipeline tab — full workflow) ─────────────────────────────
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
  const gc = GRADE_COLOR[lead.grade] || C.muted;

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
    } catch (e) {
      console.error("Enrich failed:", e);
    }
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

      {/* Header */}
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>{lead.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{lead.city}</span>
            {lead.grade && <Pill color={gc} sm>Grade {lead.grade}</Pill>}
            {lead.websiteType === "link_in_bio" && <Pill color={C.amber} sm>Link-in-bio</Pill>}
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

      {/* Status buttons */}
      <div style={{ padding: "0 18px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
        {Object.entries(STATUS).map(([id, st]) => (
          <button key={id} onClick={() => onStatusChange(lead.id, id)}
            style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: lead.status === id ? `${st.color}18` : "transparent", border: `1px solid ${lead.status === id ? st.color : C.border}`, color: lead.status === id ? st.color : C.muted }}>
            {st.label}
          </button>
        ))}
      </div>

      {editing && <EditPanel data={editData} onChange={setEditData} onSave={saveEdit} onCancel={() => setEditing(false)} />}
      <CopyPanel prospect={liveLead} onSend={() => onStatusChange(lead.id, "contacted")} />
    </div>
  );
}

async function dismissLead(name) {
  try {
    await fetch("/api/dismissed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "",
      },
      body: JSON.stringify({ name }),
    });
  } catch {}
}

async function loadDismissed() {
  try {
    const res = await fetch("/api/dismissed", {
      headers: { "x-app-pin": process.env.NEXT_PUBLIC_APP_PIN || "" },
    });
    const d = await res.json();
    return new Set(d.dismissed || []);
  } catch { return new Set(); }
}

// ─── LEAD SCRAPER ─────────────────────────────────────────────────────────────
function LeadScraper({ state, setState, onAdd, pipelineNames }) {
  const { niche = "", prospects = [], loading = false, error = "" } = state;
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    loadDismissed().then(setDismissed);
  }, []);

  async function search() {
    if (!niche.trim()) return;
    setState(s => ({ ...s, loading: true, error: "" }));
    const data = await fetchLeads(niche);
    if (data.error) { setState(s => ({ ...s, loading: false, error: data.error })); return; }
    const newProspects = data.prospects || [];
    setState(s => {
      const existing = s.prospects || [];
      const existingNames = new Set(existing.map(p => p.name));
      const merged = [...existing, ...newProspects.filter(p => !existingNames.has(p.name))];
      return { ...s, loading: false, prospects: merged, lastSearch: niche };
    });
  }

  function handleDismiss(name) {
    setDismissed(prev => new Set([...prev, name]));
    dismissLead(name);
    setState(s => ({ ...s, prospects: s.prospects.filter(p => p.name !== name) }));
  }

  const visible = prospects.filter(p => !dismissed.has(p.name));
  const aGrade  = visible.filter(p => p.grade === "A");
  const bGrade  = visible.filter(p => p.grade === "B");
  const cGrade  = visible.filter(p => p.grade === "C");
  const dGrade  = visible.filter(p => p.grade === "D");
  const noSite  = visible.filter(p => !p.hasWebsite);

  const gradeGroups = [
    { grade: "A", label: "Grade A — Perfect Fit",           color: C.green, items: aGrade },
    { grade: "B", label: "Grade B — Solid Prospect",        color: C.amber, items: bGrade },
    { grade: "C", label: "Grade C — Redesign / Care Plan",  color: C.blue,  items: cGrade },
    { grade: "D", label: "Grade D — Has Website",           color: C.muted, items: dGrade },
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
          <button onClick={() => setState(s => ({ ...s, prospects: [] }))} style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 0 }}>
            Clear all results
          </button>
        )}
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "10px 0 0" }}>Error: {error}</p>}
      </Card>

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
      cold:     "Write a cold outreach EMAIL with Subject: line. Use their real data. Human, value-first, Calendly close.",
      dm:       "Write a cold Instagram DM. 3-4 sentences. References real data. Soft Calendly close. No em-dashes.",
      followup: "Write a follow-up email. No reply to first outreach. Brief, no pressure, specific re-pitch.",
      warm:     "Write a closing email. They showed interest. Move them to book on Calendly. Confident and short.",
    };
    const r = await ai(RWS_CTX + `\n\n${prompts[type]}\nSign: Trafton Rogers | RWS | trogers@rogers-websolutions.com`, target);
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
                style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: selected?.id === l.id ? `${C.purple}20` : "rgba(255,255,255,0.04)", border: `1px solid ${selected?.id === l.id ? C.purple : C.border}`, color: selected?.id === l.id ? C.purple : C.sub, transition: "all 0.15s" }}>
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
              style={{ fontFamily: MONO, fontSize: 10, padding: "6px 13px", borderRadius: 20, cursor: "pointer", background: type === t.id ? `${C.purple}18` : "transparent", border: `1px solid ${type === t.id ? C.purple : C.border}`, color: type === t.id ? C.purple : C.muted, transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Btn onClick={generate} loading={loading} disabled={!selected && !custom.trim()} color={C.purple}>
        Generate {types.find(t => t.id === type)?.label}
      </Btn>

      {(loading || output) && (
        <div style={{ marginTop: 14 }}>
          <TextBox value={output} loading={loading} placeholder="" />
          {output && <div style={{ marginTop: 8 }}><CopyBtn text={output} sm /></div>}
        </div>
      )}
    </Card>
  );
}

// ─── FOLLOW-UP HELPERS ────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function followUpStatus(lead) {
  if (!["contacted", "followup"].includes(lead.status)) return null;
  const days = daysSince(lead.contactedAt || lead.addedAt);
  if (days === null) return null;
  if (lead.status === "contacted" && days >= 4)  return { label: `${days}d — Follow-up due`, color: C.amber, urgent: true };
  if (lead.status === "followup"  && days >= 4)  return { label: `${days}d — Second bump due`, color: C.red, urgent: true };
  if (lead.status === "contacted" && days >= 2)  return { label: `${days}d — Sent`, color: C.blue, urgent: false };
  return { label: `${days}d since contact`, color: C.muted, urgent: false };
}

// ─── OUTREACH LOG HELPERS ─────────────────────────────────────────────────────
function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function getOutreachLog() {
  try { return JSON.parse(localStorage.getItem("rws_outreach_log") || "{}"); } catch { return {}; }
}

function logOutreach(type) {
  const log = getOutreachLog();
  const key = getTodayKey();
  if (!log[key]) log[key] = { dms: 0, emails: 0 };
  log[key][type]++;
  const keys = Object.keys(log).sort().slice(-30);
  const trimmed = {};
  keys.forEach(k => { trimmed[k] = log[k]; });
  localStorage.setItem("rws_outreach_log", JSON.stringify(trimmed));
}

function getWeekLog() {
  const log = getOutreachLog();
  let dms = 0, emails = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    if (log[key]) { dms += log[key].dms || 0; emails += log[key].emails || 0; }
  }
  return { dms, emails, today: log[getTodayKey()] || { dms: 0, emails: 0 } };
}

// ─── PIPELINE MODULE ──────────────────────────────────────────────────────────
function PipelineModule({ pipeline, onUpdate, onRemove, onLogOutreach }) {
  const [filter,  setFilter]  = useState("all");
  const [weekLog, setWeekLog] = useState(() => getWeekLog());

  const active    = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const closed    = pipeline.filter(l => l.status === "closed").length;
  const contacted = pipeline.filter(l => l.status !== "new").length;

  const followUps = pipeline.filter(l => {
    const fu = followUpStatus(l);
    return fu?.urgent;
  });

  const visible = filter === "all" ? pipeline : pipeline.filter(l => l.status === filter);

  function handleStatusChange(id, newStatus) {
    const patch = { status: newStatus };
    if (newStatus === "contacted" || newStatus === "followup") {
      patch.contactedAt = new Date().toISOString();
    }
    onUpdate(id, patch);
  }

  function handleLogDM() {
    logOutreach("dms");
    setWeekLog(getWeekLog());
  }

  function handleLogEmail() {
    logOutreach("emails");
    setWeekLog(getWeekLog());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Total",     val: pipeline.length, color: C.sub    },
          { label: "Active",    val: active,          color: C.green  },
          { label: "Contacted", val: contacted,       color: C.blue   },
          { label: "Closed",    val: closed,          color: C.purple },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 500, color: s.color, marginBottom: 3 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Label>Outreach Log</Label>
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: C.purple }}>{weekLog.today.dms}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: 6 }}>DMs today</span>
              </div>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: C.green }}>{weekLog.today.emails}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: 6 }}>Emails today</span>
              </div>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: C.blue }}>{weekLog.dms + weekLog.emails}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: 6 }}>Total this week</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={handleLogDM} color={C.purple} sm>+ DM Sent</Btn>
            <Btn onClick={handleLogEmail} color={C.green} sm>+ Email Sent</Btn>
          </div>
        </div>
      </Card>

      {followUps.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Dot color={C.red} pulse />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.red, letterSpacing: "0.12em", textTransform: "uppercase" }}>Follow-up Due ({followUps.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {followUps.map(l => {
              const fu = followUpStatus(l);
              return (
                <div key={l.id} style={{ background: `${C.red}08`, border: `1px solid ${C.red}30`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.text }}>{l.name}</span>
                      {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, textDecoration: "none" }}>{l.instagramHandle || "IG"}</a>}
                      {l.phone && <span style={{ fontFamily: MONO, fontSize: 10, color: C.sub }}>{l.phone}</span>}
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: fu.color }}>{fu.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn sm color={C.amber} onClick={() => handleStatusChange(l.id, "followup")}>Mark Follow-up Sent</Btn>
                    <Btn sm color={C.green}  onClick={() => handleStatusChange(l.id, "warm")}>Mark Warm</Btn>
                    <Btn sm color={C.red}    onClick={() => handleStatusChange(l.id, "cold")}>Mark Cold</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", label: `All (${pipeline.length})` }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: `${s.label} (${pipeline.filter(l => l.status === id).length})` }))].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: filter === f.id ? `${C.green}14` : "transparent", border: `1px solid ${filter === f.id ? C.green : C.border}`, color: filter === f.id ? C.green : C.muted }}>
            {f.label}
          </button>
        ))}
      </div>

      {pipeline.length === 0
        ? <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", textAlign: "center", margin: 0 }}>No leads yet — search in Leads tab and hit + Pipeline</p></Card>
        : visible.length === 0
          ? <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", textAlign: "center", margin: 0 }}>No leads with this status</p></Card>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map(l => (
                <PipelineCard
                  key={l.id}
                  lead={l}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
      }
    </div>
  );
}

// ─── COMMAND CENTER ────────────────────────────────────────────────────────────
function CommandCenter({ prepData }) {
  const [tab, setTab]               = useState("leads");
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [emailState,    setEmailState]    = useState({});
  const [calendarState, setCalendarState] = useState({});
  const [leadsState,    setLeadsState]    = useState({
    niche:     prepData?.niche || "",
    prospects: prepData?.prospects || [],
    loading:   false,
    error:     "",
  });
  const [outreachState, setOutreachState] = useState({ type: "cold" });
  const [pipeline, setPipelineRaw] = useState([]);

  useEffect(() => {
    loadPipeline().then(saved => {
      if (saved.length > 0) {
        setPipelineRaw(saved);
      } else if (prepData?.prospects?.length > 0) {
        const seeds = prepData.prospects
          .filter(p => p.grade === "A")
          .slice(0, 3)
          .map(p => ({ id: `${Date.now()}-${Math.random()}`, status: "new", notes: "", addedAt: new Date().toLocaleDateString(), ...p }));
        setPipelineRaw(seeds);
      }
      setPipelineLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (pipelineLoaded && pipeline.length >= 0) {
      savePipeline(pipeline);
    }
  }, [pipeline, pipelineLoaded]);

  function addToPipeline(prospect) {
    if (pipelineNames.has(prospect.name)) return;
    setPipelineRaw(p => [...p, {
      id: `${Date.now()}-${Math.random()}`,
      status: prospect.status || "new",
      notes: "",
      addedAt: new Date().toLocaleDateString(),
      ...prospect,
    }]);
  }

  function updateLead(id, patch) {
    setPipelineRaw(p => p.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  function removeLead(id) {
    setPipelineRaw(p => p.filter(l => l.id !== id));
  }

  const pipelineNames  = new Set(pipeline.map(l => l.name));
  const activePipeline = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const followUpDue    = pipeline.filter(l => followUpStatus(l)?.urgent).length;

  const tabs = [
    { id: "email",    label: "Email",    dot: C.green  },
    { id: "calendar", label: "Calendar", dot: C.blue   },
    { id: "leads",    label: "Leads",    dot: C.amber  },
    { id: "outreach", label: "Outreach", dot: C.purple },
    { id: "pipeline", label: "Pipeline", dot: followUpDue > 0 ? C.red : C.green, badge: followUpDue > 0 ? `${followUpDue} due` : (activePipeline || null) },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: BODY, backgroundImage: `radial-gradient(ellipse 70% 35% at 10% 0%, rgba(0,230,118,0.03) 0%, transparent 50%)` }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Dot color={C.green} pulse size={8} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, letterSpacing: "0.04em" }}>RWS Command</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>· ops.rogers-websolutions.com</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[{ c: C.green, l: "Gmail" }, { c: C.blue, l: "GCal" }, { c: C.green, l: "AI" }, { c: pipelineLoaded ? C.green : C.amber, l: "Pipeline" }].map(s => (
              <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Dot color={s.c} size={5} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer", color: tab === t.id ? C.text : C.muted, borderBottom: `2px solid ${tab === t.id ? t.dot : "transparent"}`, transition: "all 0.15s" }}>
              <Dot color={tab === t.id ? t.dot : C.muted} size={5} />
              {t.label}
              {t.badge && <span style={{ fontFamily: MONO, fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}30` }}>{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: tab === "email"    ? "block" : "none" }}><EmailModule    state={emailState}    setState={setEmailState} /></div>
        <div style={{ display: tab === "calendar" ? "block" : "none" }}><CalendarModule state={calendarState} setState={setCalendarState} /></div>
        <div style={{ display: tab === "leads"    ? "block" : "none" }}><LeadScraper    state={leadsState}    setState={setLeadsState} onAdd={addToPipeline} pipelineNames={pipelineNames} /></div>
        <div style={{ display: tab === "outreach" ? "block" : "none" }}><OutreachModule state={outreachState} setState={setOutreachState} pipeline={pipeline} /></div>
        <div style={{ display: tab === "pipeline" ? "block" : "none" }}><PipelineModule pipeline={pipeline} onUpdate={updateLead} onRemove={removeLead} /></div>
      </div>

      <style>{`
        @keyframes blink  {0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes ripple {0%{box-shadow:0 0 0 0 rgba(0,230,118,0.45)}100%{box-shadow:0 0 0 12px rgba(0,230,118,0)}}
        *{box-sizing:border-box} button:hover:not(:disabled){opacity:0.78}
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.16)}
      `}</style>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const [unlocked, setUnlocked] = useState(false);
  const [entered,  setEntered]  = useState(false);
  const [prepData, setPrepData] = useState(null);

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  if (!entered)  return <LoginScreen onEnter={() => setEntered(true)} onPrepReady={setPrepData} />;
  return <CommandCenter prepData={prepData} />;
}
