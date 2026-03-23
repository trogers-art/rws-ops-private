"use client";
import { useState, useEffect } from "react";

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

const GRADE_COLOR = { A: C.green, B: C.amber, C: C.muted };

const RWS_CTX = `You are the AI operations assistant for Rogers Web Solutions (RWS), a web design agency in Anaheim / Orange County, CA run by Trafton Rogers.

KEY FACTS:
- Trafton works a full-time day job 8-5 M-F as a Senior Network Engineer in Anaheim
- RWS builds affordable websites ($500-$1,000) with monthly care plans ($150-$300/mo)
- Target clients: local OC small businesses — trades (HVAC, plumbing, electrical), nail techs, handymen, independent motels, Instagram-based service businesses
- Email: trogers@rogers-websolutions.com | Calendly: calendly.com/trogers-rogers-websolutions/30min
- Only available evenings and weekends

TRAFTON'S VOICE — follow this exactly in all copy:
- Direct and confident. Get to the point in the first sentence.
- Consultative, not salesy. Point out a real problem, don't pitch a product.
- Conversational but professional. Real person, not a marketing department.
- Data-driven when available. Reference real ratings, review counts, missing website specifically.
- Short. Every word earns its place. No padding.
- Low-pressure close. Invite a conversation, don't close in the first message.
- NEVER say: leverage, digital footprint, I'd love the opportunity, I hope this finds you well, we help businesses grow, synergy, solutions
- NEVER use em-dashes, exclamation points, or fake casual openers
- NEVER invent data. Only reference facts provided about the actual business.`;

const NICHES = [
  "HVAC companies Orange County",
  "nail salons Anaheim",
  "handymen Tustin",
  "plumbers Orange County",
  "electricians Fullerton",
  "motels Orange County",
  "landscapers Anaheim",
];

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
      {loading ? <span style={{ animation: "blink 0.9s step-start infinite" }}>···</span> : children}
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

function CopyBtn({ text, label = "Copy", sm }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return <Btn onClick={copy} color={copied ? C.green : C.muted} sm={sm}>{copied ? "Copied ✓" : label}</Btn>;
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

  const now       = new Date();
  const hour      = now.getHours();
  const greet     = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayStr    = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isWeekend = [0, 6].includes(now.getDay());
  const todayNiche = NICHES[now.getDay() % NICHES.length];

  useEffect(() => {
    const briefP = ai(
      RWS_CTX + `\n\nGenerate a daily briefing. Return ONLY valid JSON, no backticks:
{"synopsis":"2-3 sentences. Day/date. Weekend means no day job.","focus":"Single highest-leverage RWS task today.","tech":"2 sentences on a specific real networking/AI/web infrastructure trend relevant to a Senior Network Engineer building a web side business.","motivation":"One grounded, punchy sentence. No quotes. Not cheesy."}`,
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
        const drafts = {};
        await Promise.all(prospects.filter(p => p.grade !== "C").map(async p => {
          const raw = await ai(
            RWS_CTX + `\n\nWrite an IG DM and cold email for this real business. Return ONLY valid JSON, no backticks:
{"dm":"3-4 sentence Instagram DM. Reference their real rating/reviews if strong. Mention no website. Calendly close. Human voice.","emailSubject":"Subject line referencing their real data","emailBody":"Cold email body. Use real rating and review count. Call out the website gap. 3-4 short paragraphs. Calendly close. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com"}`,
            `Business: ${p.name} | City: ${p.city} | Rating: ${p.rating} | Reviews: ${p.reviews} | Category: ${p.category} | Has website: ${p.hasWebsite}`
          );
          try { drafts[p.name] = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
          catch { drafts[p.name] = { dm: raw, emailSubject: `Your ${p.rating}-star reputation deserves a website`, emailBody: raw }; }
        }));
        onPrepReady({ prospects, drafts, niche: todayNiche });
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
                {prepStatus === "running" ? `Pulling real businesses: ${todayNiche}` : "Real leads + copy ready in Leads tab"}
              </p>
            </div>
            <Pill color={prepStatus === "done" ? C.green : C.amber}>{prepStatus === "done" ? "ready" : "pulling"}</Pill>
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
    const result = await ai(
      RWS_CTX + `\n\nTriage this real inbox. For each: is it an RWS lead? Does it need a reply? Recommended action (reply / ignore / follow-up)? Be direct. FORMAT: FROM / SUBJECT / SUMMARY / ACTION`,
      `${data.emails.length} unread emails:\n\n${emailSummary}`
    );
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
            <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Connect Gmail</a>
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

    const result = await ai(RWS_CTX + `\n\nReview Trafton's calendar. Flag anything during 8-5 M-F. Note evening/weekend slots available for RWS calls. Clean day-by-day summary.`, `Events next 7 days:\n${evtText}`);
    setState(s => ({ ...s, summary: result, loading: false }));
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.blue} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Calendar</span>
        <Pill color={C.blue} sm>GCal</Pill>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Btn onClick={pullWeek} loading={loading} color={C.blue}>Pull This Week</Btn>
      </div>
      {authError
        ? <div style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 8, padding: "13px 15px" }}>
            <p style={{ fontFamily: MONO, fontSize: 11, color: C.amber, margin: "0 0 8px" }}>Google not authorized.</p>
            <a href="/api/auth/google" style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>Connect Google</a>
          </div>
        : <TextBox value={summary} loading={loading} placeholder="Pull your week — reads your real Google Calendar." />
      }
    </Card>
  );
}

// ─── LEAD CARD ────────────────────────────────────────────────────────────────
function LeadCard({ prospect, prepDraft, onAdd, inPipeline }) {
  const [expanded, setExpanded]     = useState(false);
  const [draft, setDraft]           = useState(prepDraft || null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [recipientEmail, setRecipient] = useState("");
  const [showSendForm, setShowSendForm] = useState(false);

  const gc = GRADE_COLOR[prospect.grade] || C.muted;

  async function generateCopy() {
    if (draft) { setExpanded(e => !e); return; }
    setGenerating(true);
    const raw = await ai(
      RWS_CTX + `\n\nWrite an IG DM and cold email for this REAL business. Return ONLY valid JSON, no backticks:
{"dm":"3-4 sentences. Instagram DM. Reference real rating and review count if notable. Specifically mention no website. End with Calendly link. Casual but not sycophantic.","emailSubject":"Subject line using their real data points","emailBody":"Cold email. First line hooks with their real numbers. Body explains the website gap and what they're losing. Short paragraphs. Calendly close. Sign: Trafton Rogers | Rogers Web Solutions | trogers@rogers-websolutions.com"}`,
      `Business: ${prospect.name} | City: ${prospect.city} | Category: ${prospect.category} | Rating: ${prospect.rating} stars | Reviews: ${prospect.reviews} | Has website: ${prospect.hasWebsite} | Google Maps: ${prospect.mapsUrl}`
    );
    try { setDraft(JSON.parse(raw.replace(/```json|```/g, "").trim())); }
    catch { setDraft({ dm: raw, emailSubject: `${prospect.name} — ${prospect.reviews} reviews, no website`, emailBody: raw }); }
    setGenerating(false);
    setExpanded(true);
  }

  async function handleSend() {
    if (!recipientEmail.trim() || !draft) return;
    setSending(true); setSendResult(null);
    const result = await sendEmail(recipientEmail, draft.emailSubject, draft.emailBody);
    setSendResult(result.success ? "sent" : "error");
    setSending(false);
    if (result.success) { setShowSendForm(false); onAdd({ ...prospect, status: "contacted" }); }
  }

  return (
    <div style={{ background: C.cardHi, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: C.text }}>{prospect.name}</span>
            <Pill color={gc} sm>Grade {prospect.grade}</Pill>
            {!prospect.hasWebsite && <Pill color={C.green} sm>No website</Pill>}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: "0 0 5px" }}>{prospect.address}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {prospect.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {prospect.rating} ({prospect.reviews} reviews)</span>}
            <a href={prospect.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Google Maps</a>
            {prospect.website && <a href={prospect.website} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.sub, textDecoration: "none" }}>Website</a>}
          </div>
          <p style={{ fontFamily: MONO, fontSize: 10, color: gc, margin: "6px 0 0" }}>{prospect.gradeReason}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Btn onClick={() => onAdd(prospect)} disabled={inPipeline} color={inPipeline ? C.purple : C.green} sm>{inPipeline ? "Added" : "+ Pipeline"}</Btn>
          <Btn onClick={generateCopy} loading={generating} color={C.amber} sm>{draft ? (expanded ? "Hide" : "Show Copy") : "Get Copy"}</Btn>
        </div>
      </div>

      {expanded && draft && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>IG DM</Label>
              <CopyBtn text={draft.dm} label="Copy DM" sm />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.dm}</div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label>Cold Email</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <CopyBtn text={`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`} label="Copy" sm />
                <Btn onClick={() => setShowSendForm(f => !f)} color={C.green} sm>Send via Gmail</Btn>
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 6 }}>Subject: {draft.emailSubject}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.75, color: C.text, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>{draft.emailBody}</div>

            {showSendForm && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <input value={recipientEmail} onChange={e => setRecipient(e.target.value)} placeholder="recipient@email.com"
                  style={{ flex: 1, background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border2}`, borderRadius: 7, padding: "8px 12px", fontFamily: MONO, fontSize: 12, color: C.text, outline: "none" }} />
                <Btn onClick={handleSend} loading={sending} disabled={!recipientEmail.trim()} color={C.green} sm>Send</Btn>
              </div>
            )}
            {sendResult === "sent"  && <p style={{ fontFamily: MONO, fontSize: 11, color: C.green, margin: "8px 0 0" }}>Sent from trogers@rogers-websolutions.com</p>}
            {sendResult === "error" && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red,   margin: "8px 0 0" }}>Send failed — check Gmail auth</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LEAD SCRAPER MODULE ──────────────────────────────────────────────────────
function LeadScraper({ state, setState, onAdd, pipelineNames }) {
  const { niche = "", prospects = [], loading = false, error = "", prepDrafts = {} } = state;

  async function search() {
    if (!niche.trim()) return;
    setState(s => ({ ...s, loading: true, prospects: [], error: "" }));
    const data = await fetchLeads(niche);
    if (data.error) { setState(s => ({ ...s, loading: false, error: data.error })); return; }
    setState(s => ({ ...s, loading: false, prospects: data.prospects || [] }));
  }

  const aGrade = prospects.filter(p => p.grade === "A");
  const bGrade = prospects.filter(p => p.grade === "B");
  const noSite = prospects.filter(p => !p.hasWebsite);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Dot color={C.amber} />
          <span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Lead Scraper</span>
          <Pill color={C.blue} sm>Google Maps · Real Data</Pill>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field value={niche} onChange={v => setState(s => ({ ...s, niche: v }))} placeholder="e.g. nail salons Anaheim, HVAC Orange County, plumbers Tustin" onKeyDown={e => e.key === "Enter" && search()} />
          <Btn onClick={search} loading={loading} disabled={!niche.trim()} color={C.amber}>Search</Btn>
        </div>
        {error && <p style={{ fontFamily: MONO, fontSize: 11, color: C.red, margin: "10px 0 0" }}>Error: {error}</p>}
      </Card>

      {loading && (
        <Card><p style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}><span style={{ animation: "blink 0.9s step-start infinite" }}>Pulling real businesses from Google Maps...</span></p></Card>
      )}

      {!loading && prospects.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Total Found", val: prospects.length, color: C.sub   },
              { label: "No Website",  val: noSite.length,   color: C.green },
              { label: "Grade A",     val: aGrade.length,   color: C.amber },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 500, color: s.color, marginBottom: 3 }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {aGrade.length > 0 && (
            <div>
              <div style={{ marginBottom: 10 }}><Pill color={C.green}>Grade A — Best Prospects</Pill></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {aGrade.map((p, i) => <LeadCard key={i} prospect={p} prepDraft={prepDrafts[p.name]} onAdd={onAdd} inPipeline={pipelineNames.has(p.name)} />)}
              </div>
            </div>
          )}

          {bGrade.length > 0 && (
            <div>
              <div style={{ marginBottom: 10, marginTop: 6 }}><Pill color={C.amber}>Grade B</Pill></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bGrade.map((p, i) => <LeadCard key={i} prospect={p} prepDraft={prepDrafts[p.name]} onAdd={onAdd} inPipeline={pipelineNames.has(p.name)} />)}
              </div>
            </div>
          )}
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
      ? `Business: ${selected.name} | City: ${selected.city} | Rating: ${selected.rating} stars | Reviews: ${selected.reviews} | Has website: ${selected.hasWebsite}`
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

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Dot color={C.purple} /><span style={{ fontFamily: BODY, fontSize: 16, fontWeight: 700, color: C.text }}>Outreach</span>
      </div>

      {pipeline.length > 0 && (
        <>
          <Label>Pipeline Leads</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {pipeline.filter(l => ["new","contacted","followup","warm"].includes(l.status)).map(l => (
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

// ─── PIPELINE MODULE ──────────────────────────────────────────────────────────
function PipelineModule({ pipeline, onUpdate, onRemove }) {
  const [filter,  setFilter]  = useState("all");
  const [notes,   setNotes]   = useState({});
  const [editing, setEditing] = useState(null);

  const visible = filter === "all" ? pipeline : pipeline.filter(l => l.status === filter);
  const active  = pipeline.filter(l => !["closed","cold"].includes(l.status)).length;
  const closed  = pipeline.filter(l => l.status === "closed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[{ label: "Total", val: pipeline.length, color: C.sub }, { label: "Active", val: active, color: C.green }, { label: "Closed", val: closed, color: C.purple }].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 500, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

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
                        {l.rating > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>★ {l.rating} ({l.reviews} reviews) </span>}
                        {l.mapsUrl && <a href={l.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: 11, color: C.blue, textDecoration: "none" }}>Maps</a>}
                      </div>
                      <Pill color={s.color}>{s.label}</Pill>
                    </div>
                    <p style={{ fontFamily: BODY, fontSize: 12, color: C.sub, margin: "0 0 12px" }}>{l.gradeReason || l.why || ""}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {Object.entries(STATUS).map(([id, st]) => (
                        <button key={id} onClick={() => onUpdate(l.id, { status: id })}
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
  const [tab, setTab] = useState("leads");

  // All module state lives here — persists across tab switches
  const [emailState,    setEmailState]    = useState({});
  const [calendarState, setCalendarState] = useState({});
  const [leadsState,    setLeadsState]    = useState({
    niche:      prepData?.niche || "",
    prospects:  prepData?.prospects || [],
    prepDrafts: prepData?.drafts || {},
    loading:    false,
    error:      "",
  });
  const [outreachState, setOutreachState] = useState({ type: "cold" });
  const [pipeline, setPipeline] = useState(
    (prepData?.prospects || [])
      .filter(p => p.grade === "A")
      .slice(0, 3)
      .map(p => ({ id: Date.now() + Math.random(), status: "new", notes: "", addedAt: new Date().toLocaleDateString(), ...p }))
  );

  function addToPipeline(prospect) {
    if (pipelineNames.has(prospect.name)) return;
    setPipeline(p => [...p, { id: Date.now() + Math.random(), status: prospect.status || "new", notes: "", addedAt: new Date().toLocaleDateString(), ...prospect }]);
  }

  const pipelineNames  = new Set(pipeline.map(l => l.name));
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
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
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
        {/* All modules always mounted — display toggled — this is what prevents state loss */}
        <div style={{ display: tab === "email"    ? "block" : "none" }}><EmailModule    state={emailState}    setState={setEmailState} /></div>
        <div style={{ display: tab === "calendar" ? "block" : "none" }}><CalendarModule state={calendarState} setState={setCalendarState} /></div>
        <div style={{ display: tab === "leads"    ? "block" : "none" }}><LeadScraper    state={leadsState}    setState={setLeadsState} onAdd={addToPipeline} pipelineNames={pipelineNames} /></div>
        <div style={{ display: tab === "outreach" ? "block" : "none" }}><OutreachModule state={outreachState} setState={setOutreachState} pipeline={pipeline} /></div>
        <div style={{ display: tab === "pipeline" ? "block" : "none" }}><PipelineModule pipeline={pipeline} onUpdate={(id, p) => setPipeline(prev => prev.map(l => l.id === id ? { ...l, ...p } : l))} onRemove={id => setPipeline(prev => prev.filter(l => l.id !== id))} /></div>
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
