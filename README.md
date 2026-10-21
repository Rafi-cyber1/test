# The Gym Town Enterprise

Gym management application for member records, attendance, membership plans, fee collection, inventory, reporting, and front-desk administration.

## Run in a browser

**Prerequisite:** Node.js and npm.

```bash
npm install
npm run dev
```

The browser app stores its data in that browser's `localStorage`. Data is local to the browser profile and is not synchronized between computers. Use **Settings → Backup & Restore** to export or restore a JSON backup.

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
