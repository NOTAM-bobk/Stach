# Staches

A clean, minimal link saver. Save links into groups, search and filter them,
all backed by your own Cloudflare account. Everything below can be done
from a browser — you don't need a computer with Node installed.

## What's in here

```
index.html          entry HTML
package.json         dependencies + build script (Vercel reads this)
vite.config.js        build tool config
src/main.jsx          React entry point
src/App.jsx            switches between onboarding and the dashboard
src/Onboarding.jsx      feature intro + login/signup screen
src/Dashboard.jsx        the actual app: groups, links, search
src/api.js               talks to your Cloudflare Worker
src/index.css             all styling

worker/index.js        the Cloudflare Worker (your API)
worker/schema.sql        database tables
worker/wrangler.toml      worker config (only needed if you ever use the CLI)
```

## 1. Put this on GitHub

1. Go to github.com, create a new repository called `staches`.
2. Use the "upload files" option on the repo page (or "Add file" ->
   "Upload files") and drag in every file above, keeping the folder
   structure (`src/...`, `worker/...`).
3. Commit.

## 2. Set up the backend (Cloudflare)

You'll create a free D1 database and a free Worker, both from the
Cloudflare dashboard — no CLI needed.

**Database:**
1. In the Cloudflare dashboard, go to **Workers & Pages -> D1**.
2. Create a database named `staches-db`.
3. Open it, go to the **Console** tab, paste the contents of
   `worker/schema.sql`, and run it. This creates the `users`, `groups`,
   and `links` tables.

**Worker:**
1. Go to **Workers & Pages -> Create -> Worker**. Name it `staches-api`
   and deploy the default template.
2. Open the new Worker, go to **Edit code** (the online code editor),
   delete everything in `index.js`, and paste in the contents of
   `worker/index.js` from this repo. Deploy.
3. Go to **Settings -> Variables**:
   - Under **D1 Database Bindings**, add a binding named `DB` pointing
     to `staches-db`.
   - Under **Environment Variables**, add a **secret** named
     `JWT_SECRET` and set it to any long random string (this signs
     login tokens — keep it private).
4. Note your Worker's URL, something like
   `https://staches-api.<your-subdomain>.workers.dev`. You'll need it
   in step 3.

## 3. Deploy the frontend (Vercel)

1. Go to vercel.com, **Add New -> Project**, and import your `staches`
   GitHub repo. Vercel auto-detects Vite — leave the defaults.
2. Before deploying, add an **Environment Variable**:
   - `VITE_API_URL` = your Worker URL from step 2 (no trailing slash).
3. Deploy. Vercel will give you a live URL for Staches.

That's it — visit the URL, sign up, and start saving links. Every push
to the GitHub repo redeploys automatically.

## Notes

- Passwords are hashed (PBKDF2) before they're stored — the Worker
  never stores plain text passwords.
- Login sessions last 30 days (a JWT stored in the browser's
  localStorage).
- Everything here fits Cloudflare's free tier (D1 + Workers) and
  Vercel's free tier.
- If you ever want to edit the Worker locally with the `wrangler` CLI
  instead of the dashboard, `worker/wrangler.toml` is already set up —
  just fill in your D1 `database_id` from the D1 dashboard.
