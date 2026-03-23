# RWS Command Center — Deploy Guide
## ops.rogers-websolutions.com

---

## STEP 1 — Google Cloud Console Setup (~10 min)

1. Go to https://console.cloud.google.com
2. Click "New Project" → name it "RWS Ops" → Create
3. In the left menu: **APIs & Services → Enable APIs**
   - Enable: **Gmail API**
   - Enable: **Google Calendar API**
4. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: RWS Ops
   - User support email: trogers@rogers-websolutions.com
   - Add scopes: gmail.readonly, gmail.modify, calendar.readonly
   - Add test user: trogers@rogers-websolutions.com
   - Save
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: RWS Ops
   - Authorized redirect URIs: `https://ops.rogers-websolutions.com/api/auth/callback`
   - Click Create → **copy your Client ID and Client Secret**

---

## STEP 2 — GitHub Repo

```bash
cd rws-ops
git init
git add .
git commit -m "initial"
# Create a new repo at github.com (call it rws-ops, private)
git remote add origin https://github.com/YOUR_USERNAME/rws-ops.git
git push -u origin main
```

---

## STEP 3 — Vercel Deploy

1. Go to https://vercel.com → Add New Project
2. Import your `rws-ops` GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **Environment Variables** and add ALL of these before deploying:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `GOOGLE_CLIENT_ID` | From Step 1 |
| `GOOGLE_CLIENT_SECRET` | From Step 1 |
| `GOOGLE_REDIRECT_URI` | `https://ops.rogers-websolutions.com/api/auth/callback` |
| `NEXT_PUBLIC_APP_PIN` | Choose a PIN (e.g. your own 4–6 digit code) |
| `GOOGLE_REFRESH_TOKEN` | Leave blank for now — you'll add this in Step 5 |

5. Click **Deploy**

---

## STEP 4 — Custom Domain

1. In Vercel: Project → Settings → Domains
2. Add: `ops.rogers-websolutions.com`
3. Vercel gives you a CNAME value — go to your domain registrar (GoDaddy, Namecheap, etc.)
4. Add a CNAME record:
   - Name/Host: `ops`
   - Value: the CNAME Vercel gave you (e.g. `cname.vercel-dns.com`)
5. DNS propagates in 5–30 min. Vercel auto-provisions SSL.

---

## STEP 5 — Authorize Google (One Time)

Once your domain is live:

1. Open your browser → go to `https://ops.rogers-websolutions.com/api/auth/google`
2. You'll be redirected to Google's consent screen
3. Sign in as trogers@rogers-websolutions.com → Allow
4. You'll land on a page showing your **refresh token**
5. Copy it → go to Vercel → Project → Settings → Environment Variables
6. Add/update: `GOOGLE_REFRESH_TOKEN` = the token you copied
7. Vercel → **Redeploy** (Deployments tab → click the three dots → Redeploy)

Gmail and Calendar are now live. ✓

---

## STEP 6 — Get Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Settings → API Keys → Create Key
3. Copy it into Vercel env as `ANTHROPIC_API_KEY`

---

## You're live.

Open `https://ops.rogers-websolutions.com`
- Enter your PIN
- Daily brief + leads generate on login
- Email tab pulls your real Gmail
- Calendar tab pulls your real GCal

---

## File Structure Reference

```
rws-ops/
├── src/
│   ├── app/
│   │   ├── layout.js              # Next.js root layout
│   │   ├── page.js                # Full app (PIN + login + dashboard)
│   │   └── api/
│   │       ├── chat/route.js      # Anthropic proxy
│   │       ├── gmail/route.js     # Real Gmail fetch
│   │       ├── calendar/route.js  # Real GCal fetch
│   │       └── auth/
│   │           ├── google/route.js   # OAuth initiation
│   │           └── callback/route.js # OAuth token exchange
│   └── lib/
│       └── google.js              # Shared OAuth client
├── next.config.js
├── package.json
└── DEPLOY.md                      # This file
```
