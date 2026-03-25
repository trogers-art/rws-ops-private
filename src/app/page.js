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
- NEVER invent data. Only use facts provided about the actual business.`;

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
  const res = await fetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: lead.name, website: lead.website, city: lead.city, category: lead.category, phone: lead.phone }),
  });
  return res.json();
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

// Pipeline persistence — sends server-side PIN header
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
        // Enrich top A-grade leads on login
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

// ─── LEAD CARD ────────────────────────────────────────────────────────────────
function LeadCard({ prospect: initialProspect, onAdd, inPipeline }) {
  const [prospect, setProspect]     = useState(initialProspect);
  const [expanded, setExpanded]     = useState(false);
  const [draft, setDraft]           = useState(null);
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching]   = useState(false);
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [recipient, setRecipient]   = useState(prospect.email || "");
  const [showSend, setShowSend]     = useState(false);

  const gc = GRADE_COLOR[prospect.grade] || C.muted;
  const isEnriched = prospect.enriched || prospect.email || prospect.instagram;

  async function handleEnrich() {
    setEnriching(true);
    const result = await enrichLead(prospect);
    setProspect(p => ({ ...p, ...result }));
    if (result.email) setRecipient(result.email);
    setEnriching(false);
  }

  async function generateCopy() {
    if (draft) { setExpanded(e => !e); return; }
    setGenerating(true);
    const contactInfo = [
      prospect.email ? `Email: ${prospect.email}` : null,
      prospect.instagram ? `Instagram: ${prospect.instagram}` : null,
      prospect.phone ? `Phone: ${prospect.phone}` : null,
    ].filter(Boolean).join(" | ");

    const raw = await ai(
      RWS_CTX + `\n\nWrite an IG DM and cold email for this REAL business. Return ONLY valid JSON, no backticks:
{"dm":"3-4 sentences. Instagram DM. Reference real rating and review count. Mention no website specifically. End with Calendly link. Human voice, not corporate.","emailSubject":"Subject line using their real data — rating, reviews, or category","emailBody":"Cold email. First line uses their real numbers to hook. Explains the website gap and what they're losing. 3-4 short paragraphs. Calendly close. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com"}`,
      `Business: ${prospect.name} | City: ${prospect.city} | Category: ${prospect.category} | Rating: ${prospect.rating} stars | Reviews: ${prospect.reviews} | Has website: ${prospect.hasWebsite} | ${contactInfo}`
    );
    try { setDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
    catch { setDraft({ dm: raw, emailSubject: `${prospect.name} — ${prospect.reviews} reviews, no website`, emailBody: raw }); }
    setGenerating(false);
    setExpanded(true);
  }

  async function handleSend() {
    if (!recipient.trim() || !draft) return;
    setSending(true); setSendResult(null);
    const result = await sendEmail(recipient, draft.emailSubject, draft.emailBody);
    setSendResult(result.success ? "sent" : "error");
    setSending(false);
    if (result.success) {
      setShowSend(false);
      logOutreach("emails");
      onAdd({ ...prospect, status: "contacted" });
    }
  }

  return (
    <div style={{ background: C.cardHi, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.text }}>{prospect.name}</span>
            <Pill color={gc} sm>Grade {prospect.grade}</Pill>
            {!prospect.hasWebsite && <Pill color={C.green} sm>No website</Pill>}
            {isEnriched && <Pill color={C.blue} sm>Enriched</Pill>}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: "0 0 5px" }}>{prospect.address}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
            {prospect.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {prospect.rating} ({prospect.reviews} reviews)</span>}
            {prospect.phone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>{prospect.phone}</span>}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <a href={prospect.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Maps</a>
            {prospect.website && <a href={prospect.website} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.sub, textDecoration: "none" }}>Website</a>}
            {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.purple, textDecoration: "none" }}>{prospect.instagramHandle || "Instagram"}</a>}
            {prospect.email && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>{prospect.email}</span>}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 10, color: gc, margin: "6px 0 0" }}>{prospect.gradeReason}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Btn onClick={() => onAdd(prospect)} disabled={inPipeline} color={inPipeline ? C.purple : C.green} sm>{inPipeline ? "Added" : "+ Pipeline"}</Btn>
          {!isEnriched && <Btn onClick={handleEnrich} loading={enriching} color={C.blue} sm>Enrich</Btn>}
          <Btn onClick={generateCopy} loading={generating} color={C.amber} sm>{draft ? (expanded ? "Hide" : "Show Copy") : "Get Copy"}</Btn>
        </div>
      </div>

      {expanded && draft && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px" }}>
          {/* IG DM */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>IG DM</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={draft.dm} label="Copy DM" sm onCopy={() => logOutreach("dms")} />
                {prospect.instagram && <a href={prospect.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: C.purple, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.purple}45`, textDecoration: "none", background: `${C.purple}12` }}>Open IG</a>}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.dm}</div>
          </div>

          {/* Cold Email */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>Cold Email</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`} label="Copy" sm />
                <Btn onClick={() => setShowSend(f => !f)} color={C.green} sm>Send via Gmail</Btn>
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {draft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.emailBody}</div>

            {showSend && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="recipient@email.com"
                  style={{ flex: 1, background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 12px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" }} />
                <Btn onClick={handleSend} loading={sending} disabled={!recipient.trim()} color={C.green} sm>Send</Btn>
              </div>
            )}
            {sendResult === "sent"  && <p style={{ fontFamily: MONO, fontSize: 11, color: C.green, margin: "8px 0 0" }}>Sent from trogers@rogers-websolutions.com — lead moved to Contacted</p>}
            {sendResult === "error" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red,   margin: "8px 0 0" }}>Send failed — check Gmail auth</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEAD SCRAPER ─────────────────────────────────────────────────────────────
function LeadScraper({ state, setState, onAdd, pipelineNames }) {
  const { niche = "", prospects = [], loading = false, error = "" } = state;

  async function search() {
    if (!niche.trim()) return;
    setState(s => ({ ...s, loading: true, error: "" }));
    // Don't wipe existing prospects — append new ones, dedup by name
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

  const aGrade = prospects.filter(p => p.grade === "A");
  const bGrade = prospects.filter(p => p.grade === "B");
  const cGrade = prospects.filter(p => p.grade === "C");
  const dGrade = prospects.filter(p => p.grade === "D");
  const noSite = prospects.filter(p => !p.hasWebsite);

  const gradeGroups = [
    { grade: "A", label: "Grade A — Perfect Fit",        color: C.green,  items: aGrade },
    { grade: "B", label: "Grade B — Solid Prospect",     color: C.amber,  items: bGrade },
    { grade: "C", label: "Grade C — Redesign / Care Plan", color: C.blue, items: cGrade },
    { grade: "D", label: "Grade D — Has Website",        color: C.muted,  items: dGrade },
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

      {!loading && prospects.length > 0 && (
        <>
          {/* Stats bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {[
              { label: "Total",    val: prospects.length, color: C.sub   },
              { label: "No Site",  val: noSite.length,   color: C.green },
              { label: "Grade A",  val: aGrade.length,   color: C.green },
              { label: "Grade B",  val: bGrade.length,   color: C.amber },
              { label: "Grade C",  val: cGrade.length,   color: C.blue  },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: s.color, marginBottom: 2 }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* All grade groups */}
          {gradeGroups.map(g => (
            <div key={g.grade}>
              <div style={{ marginBottom: 10 }}><Pill color={g.color}>{g.label}</Pill></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {g.items.map((p, i) => (
                  <LeadCard key={`${p.name}-${i}`} prospect={p} onAdd={onAdd} inPipeline={pipelineNames.has(p.name)} />
                ))}
              </div>
            </div>
          ))}
        </>
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
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function getOutreachLog() {
  try { return JSON.parse(localStorage.getItem("rws_outreach_log") || "{}"); } catch { return {}; }
}

function logOutreach(type) {
  const log = getOutreachLog();
  const key = getTodayKey();
  if (!log[key]) log[key] = { dms: 0, emails: 0 };
  log[key][type]++;
  // Keep last 30 days only
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
  const [notes,   setNotes]   = useState({});
  const [editing, setEditing] = useState(null);
  const [weekLog, setWeekLog] = useState(() => getWeekLog());

  const today     = new Date().toLocaleDateString();
  const active    = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const closed    = pipeline.filter(l => l.status === "closed").length;
  const contacted = pipeline.filter(l => l.status !== "new").length;

  // Follow-up due today
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

      {/* Stats */}
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

      {/* Outreach log */}
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

      {/* Follow-up due */}
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

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", label: `All (${pipeline.length})` }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: `${s.label} (${pipeline.filter(l => l.status === id).length})` }))].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ fontFamily: MONO, fontSize: 10, padding: "5px 12px", borderRadius: 20, cursor: "pointer", background: filter === f.id ? `${C.green}14` : "transparent", border: `1px solid ${filter === f.id ? C.green : C.border}`, color: filter === f.id ? C.green : C.muted }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      {pipeline.length === 0
        ? <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", textAlign: "center", margin: 0 }}>No leads yet — search in Leads tab and hit + Pipeline</p></Card>
        : visible.length === 0
          ? <Card><p style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.13)", textAlign: "center", margin: 0 }}>No leads with this status</p></Card>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map(l => {
                const s  = STATUS[l.status];
                const fu = followUpStatus(l);
                return (
                  <div key={l.id} style={{ background: C.card, border: `1px solid ${fu?.urgent ? C.amber + "50" : C.border2}`, borderRadius: 10, padding: "15px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.text }}>{l.name}</span>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{l.city}</span>
                          {l.grade && <Pill color={GRADE_COLOR[l.grade] || C.muted} sm>Grade {l.grade}</Pill>}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          {l.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {l.rating} ({l.reviews} reviews)</span>}
                          {l.phone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.sub }}>{l.phone}</span>}
                          {l.email && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>{l.email}</span>}
                          {l.mapsUrl && <a href={l.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Maps</a>}
                          {l.instagram && <a href={l.instagram} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.purple, textDecoration: "none" }}>{l.instagramHandle || "Instagram"}</a>}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>Added {l.addedAt}</span>
                          {l.contactedAt && <span style={{ fontFamily: MONO, fontSize: 10, color: C.blue }}>Contacted {new Date(l.contactedAt).toLocaleDateString()}</span>}
                          {fu && <span style={{ fontFamily: MONO, fontSize: 10, color: fu.color }}>{fu.label}</span>}
                        </div>
                      </div>
                      <Pill color={s.color}>{s.label}</Pill>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {Object.entries(STATUS).map(([id, st]) => (
                        <button key={id} onClick={() => handleStatusChange(l.id, id)}
                          style={{ fontFamily: MONO, fontSize: 9, padding: "3px 9px", borderRadius: 20, cursor: "pointer", background: l.status === id ? `${st.color}18` : "transparent", border: `1px solid ${l.status === id ? st.color : C.border}`, color: l.status === id ? st.color : C.muted }}>
                          {st.label}
                        </button>
                      ))}
                    </div>

                    {editing === l.id
                      ? <div style={{ display: "flex", gap: 6 }}>
                          <Field value={notes[l.id] ?? l.notes ?? ""} onChange={v => setNotes(p => ({ ...p, [l.id]: v }))} placeholder="Add notes..." rows={2} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <Btn sm color={C.green} onClick={() => { onUpdate(l.id, { notes: notes[l.id] ?? "" }); setEditing(null); }}>Save</Btn>
                            <Btn sm color={C.muted} onClick={() => setEditing(null)}>Cancel</Btn>
                          </div>
                        </div>
                      : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: l.notes ? C.sub : "rgba(255,255,255,0.15)" }}>{l.notes || "No notes"}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Btn sm color={C.blue} onClick={() => { setNotes(p => ({ ...p, [l.id]: l.notes ?? "" })); setEditing(l.id); }}>Notes</Btn>
                            <Btn sm color={C.red} onClick={() => onRemove(l.id)}>Remove</Btn>
                          </div>
                        </div>
                    }
                  </div>
                );
              })}
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

  // Load pipeline from server on mount
  useEffect(() => {
    loadPipeline().then(saved => {
      if (saved.length > 0) {
        setPipelineRaw(saved);
      } else if (prepData?.prospects?.length > 0) {
        // Seed with today's Grade A leads if pipeline is empty
        const seeds = prepData.prospects
          .filter(p => p.grade === "A")
          .slice(0, 3)
          .map(p => ({ id: `${Date.now()}-${Math.random()}`, status: "new", notes: "", addedAt: new Date().toLocaleDateString(), ...p }));
        setPipelineRaw(seeds);
      }
      setPipelineLoaded(true);
    });
  }, []);

  // Save pipeline to server whenever it changes (after initial load)
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
        {/* All modules always mounted — tab switch never wipes state */}
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
