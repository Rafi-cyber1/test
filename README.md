# The Gym Town Enterprise

Gym management application for member records, attendance, membership plans, fee collection, inventory, reporting, and front-desk administration.

## Run in a browser

**Prerequisite:** Node.js and npm.

```bash
npm install
npm run dev
```

The header has a **Dark / Light theme toggle** (Ice Blue `#168BFF` accent) and the choice is remembered per browser. Printed receipts use the original brand logo with a transparent background.

A fresh install starts with **no demo members and an empty inventory** — the only pre-configured data is the membership plan price list (Cardio / Muscle Building, admission + monthly). Add members, products, and suppliers from the app itself.

The browser app stores its data in that browser's `localStorage`. Data is local to the browser profile and is not synchronized between computers.

> ⚠️ **Without cloud sync that means:** clearing the browser's site data, opening the site in another browser / incognito window, or opening it on another device shows an **empty** app. Either turn on cloud sync below, or hand the app over together with a scheduled *Export Full Backup* routine. Use **Settings → Backup & Restore** to export or restore a JSON backup. The backup file is a *full* snapshot — members, plans, fee ledger, receipts, attendance, expenses, **inventory products, POS sales, stock purchases, suppliers**, notifications, station settings, and the audit trail — and restoring it brings every one of those modules back (older member-only backups are still accepted).

## Optional cloud sync (Vercel)

The app works fully offline with `localStorage`. If you want the desk computer and your phone to share one dataset, the repo already contains a tiny sync endpoint (`api/sync.ts`) that stores the full snapshot in Upstash Redis:

1. Vercel → **Storage/Marketplace** → add **Upstash Redis** (free) — it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
2. Vercel → **Settings → Environment Variables** → add `SYNC_SECRET` (any long random string).
3. Redeploy, then open **Settings → Database → Cloud Sync**, paste the key, **Save & test**.
4. **Upload to cloud** on the desk, **Download from cloud** on the phone.

Once the key is saved, **Auto sync** (on by default) uploads every change within ~2 seconds and pulls other desks' changes within 25 seconds — so the owner's phone sees the desk's data, and a fresh browser downloads the cloud copy instead of starting empty. The manual Upload/Download buttons remain for the first connection and for recovery. The key never ships inside the bundle. Serverless functions only run on Vercel (or `vercel dev`), not in the plain `npm run dev` preview. Details, alternatives (Supabase / Neon / Turso) and the full relational plan: `docs/database-integration-plan.md`.
Going the Supabase/Postgres route instead? `docs/supabase-setup.md` is the step-by-step, and `supabase/migrations/001_schema.sql` + `npm run import:supabase` are already in the repo.

## Phone / tablet

The layout adapts to any screen; nothing needs to be installed:

- **Below 1024 px** the sidebar turns into a slide-out drawer (hamburger at the top left) and a thumb-friendly bottom tab bar appears — Desk, Members, Attendance, Fee Record, Store (POS). The other screens (Blood Directory, Plans & Rates, Station Settings) stay one tap away inside the drawer.
- Header actions collapse to icons, toolbars wrap, and every wide table scrolls sideways inside its own panel so nothing is cut off.
- Full-screen slide-over forms (Register Member, Restock, POS sale) and dialogs (renewal, receipt, profile) fill the phone screen and scroll internally.
- The Windows-style title bar is hidden below 768 px to give the workspace more room.
- `viewport-fit=cover` plus safe-area padding keeps content clear of notches and gesture bars, and `public/manifest.webmanifest` lets the browser **Add to Home Screen** so it opens full-screen like an app.

Designed for 360–430 px phones, 768 px tablets, and desktop widths from 1024 px upwards.

Data still lives in the phone's own browser storage — it is not shared with the desk computer. See `docs/database-integration-plan.md` for how to put both on one shared database.

## Desktop app

The Windows Electron app uses browser `localStorage` in its Electron profile; it does not use SQLite or a separate database server. Desktop data remains on that computer and is separate from the browser version.

```powershell
npm install
npm run electron:dev
```

Build the Windows installer with:

```powershell
npm run electron:build
```

The installer is written to the `release` folder. The packaged `.exe` includes Electron and does not require Node.js to be installed on the gym computer. Use **Settings → Backup & Restore** to export a JSON backup before moving or safeguarding data.

## Checks

```bash
npm run lint
npm run test:integration
npm run test:e2e
npm run build
```
