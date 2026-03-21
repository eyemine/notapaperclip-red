# notapaperclip.red — Next.js App

Standalone swarm verification portal for GhostAgent.ninja.  
Calls Cloudflare Worker KV directly — no dependency on ghostagent.ninja.

## Routes

```
/                          ← Swarm search (swarmId lookup)
/verify/[hash]             ← Proof deep-link viewer
/api/verify/swarm          ← API: ?swarmId= or ?proofHash=
```

## Environment variable

```
WORKER_URL=https://nftmail-email-worker.richard-159.workers.dev
```

Set this in Hostinger's Node.js app environment variables panel.  
If not set, it falls back to the production worker URL automatically.

---

## Deploy to Hostinger (Node.js App)

### Step 1 — Build locally

```bash
npm install
npm run build
```

This produces a `.next/standalone` folder — that's what you upload.

### Step 2 — Zip the build output

```bash
cp -r .next/standalone notapaperclip-deploy
cp -r .next/static notapaperclip-deploy/.next/static
cp -r public notapaperclip-deploy/public 2>/dev/null || true
zip -r notapaperclip-deploy.zip notapaperclip-deploy
```

### Step 3 — Upload to Hostinger

1. Log in to [hPanel](https://hpanel.hostinger.com)
2. Go to **Websites → Manage → Node.js**
3. Click **Create Application**
4. Set:
   - **Node.js version**: 20.x
   - **Application root**: `/notapaperclip` (or your preferred folder)
   - **Application startup file**: `server.js`
   - **Environment variables**: Add `WORKER_URL` = `https://nftmail-email-worker.richard-159.workers.dev`
5. Click **Create**
6. Go to **File Manager**, navigate to your application root
7. Upload and unzip `notapaperclip-deploy.zip`
8. The `server.js` file is at `notapaperclip-deploy/server.js` — this is the standalone Next.js server

### Step 4 — Start the app

In hPanel → Node.js → click **Restart** or **Start** on your app.

### Step 5 — Point domain DNS (Cloudflare)

Since `notapaperclip.red` is on Cloudflare:

1. Log in to [Cloudflare dashboard](https://dash.cloudflare.com)
2. Select `notapaperclip.red` → **DNS → Records**
3. Get your Hostinger server IP: hPanel → **Hosting → Manage → Details → IP Address**
4. Set:

| Type  | Name  | Value              | Proxy status     |
|-------|-------|--------------------|------------------|
| A     | `@`   | `<Hostinger IP>`   | DNS only (grey)  |
| A     | `www` | `<Hostinger IP>`   | DNS only (grey)  |

> **Use DNS only (grey cloud)** — NOT orange proxied. Hostinger needs the real IP for SSL.

5. Delete any old A/CNAME records pointing to WordPress or old host.

### Step 6 — Enable SSL

hPanel → **SSL → Manage** → select `notapaperclip.red` → **Install** free Let's Encrypt cert.

---

## Test after deploy

```
https://notapaperclip.red/                           ← Search page
https://notapaperclip.red/?swarm=ghostagent           ← Auto-search
https://notapaperclip.red/verify/0xabc123             ← Proof deep-link
https://notapaperclip.red/api/verify/swarm?swarmId=x  ← Raw API
```

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```
