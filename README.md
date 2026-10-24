# The Gym Town Enterprise

Gym management application for member records, attendance, membership plans, fee collection, inventory, reporting, and front-desk administration.

## Run in a browser

**Prerequisite:** Node.js and npm.

```bash
npm install
npm run dev
```

The browser app stores its data in that browser's `localStorage` unless Supabase cloud sync is configured. Without Supabase, data is local to that browser profile and is not synchronized between computers. Use **Settings → Backup & Restore** to export or restore a JSON backup.

## Optional online storage with Supabase

The app can sync one gym owner's full application snapshot to Supabase. Cloud sync requires a Supabase project, the SQL schema below, an Auth user, and the public project URL and anon/publishable key. **Do not put a Supabase service-role key in this browser app.** The SQL enables row-level security and restricts each signed-in account to its own snapshot. One Supabase account is currently one gym's owner account; this is not a multi-staff role system.

1. In Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
2. In **Authentication → Users**, create/confirm the gym owner user. The app intentionally has sign-in but no public sign-up screen.
3. For local development, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings.
4. For Vercel, set those same two variables under the project's **Environment Variables**, then redeploy. For an Electron build, set them in `.env.local` before `npm run electron:build`.
5. Sign in to the app. If the cloud is empty, the current device's local snapshot is uploaded. If the cloud and device both have different member/transaction records, the app asks which copy to keep before continuing.

The app stores a local copy immediately and syncs changes to Supabase when online. A visible status badge reports sync errors; on concurrent edits, revision checks prevent a stale device from silently overwriting a newer cloud snapshot. Export JSON backups regularly to storage separate from Supabase. Free-tier limits and backup retention can change, so this feature is not a substitute for an independent tested backup.

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
