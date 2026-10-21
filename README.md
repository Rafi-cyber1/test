<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ded24fcc-39d3-4cd1-a51a-55b8da786bee

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Desktop app and database

The Windows Electron app stores its application data in a SQLite database named `gym-town.sqlite` inside Electron's user data folder. Existing Electron browser-storage data is copied into SQLite automatically the first time each value is read.

Build the Windows installer with `npm run electron:build`. SQLite data stays on that computer and is not shared with the Netlify website or other computers. The browser app deployed to Netlify continues to use that browser's local storage.

### What to install

- To develop or build the desktop app, install Node.js 22.13 or newer and npm, then run `npm install` in the project folder.
- You do **not** need to install a SQLite server or add a SQLite npm package. The desktop app uses Electron's built-in `node:sqlite` module.
- To inspect the database visually, optionally install [DB Browser for SQLite](https://sqlitebrowser.org/). This is a separate viewer and is not needed to run the app.
- The packaged Windows `.exe` includes Electron and does not require Node.js or SQLite to be installed on the gym computer.

### Run the desktop app

From the project folder:

```powershell
npm install
npm run electron:dev
```

To create the Windows installer:

```powershell
npm run electron:build
```

The installer is written to the `release` folder. `npm run dev` runs the browser version instead; that version uses the browser's local storage and does not connect to the desktop SQLite file.

### Find and open the database

The database file is `gym-town.sqlite` under Electron's per-user application data directory. On Windows, start at `%APPDATA%` (usually `C:\Users\<your-user>\AppData\Roaming`) and open the Gym Town application folder inside it. If you do not see the file, run the installed desktop app once so it can create the database, then search that application-data folder for `gym-town.sqlite`.

To view it with DB Browser for SQLite:

1. Close the Gym Town desktop app.
2. Open DB Browser for SQLite and choose **Open Database**.
3. Select `gym-town.sqlite`.
4. Use **Browse Data** to view the `app_storage` table, or **Execute SQL** to run read-only queries.

For example, list the stored keys and when each was last updated:

```sql
SELECT key, updated_at
FROM app_storage
ORDER BY key;
```

The main application state is stored as JSON text in the `value` column under the key `tgt_db_data`. For example, list member records using SQLite's JSON functions:

```sql
SELECT member.value
FROM app_storage AS app,
     json_each(app.value, '$.members') AS member
WHERE app.key = 'tgt_db_data';
```

To inspect a particular member field, for example each member's name and phone:

```sql
SELECT
  json_extract(member.value, '$.name') AS name,
  json_extract(member.value, '$.phone') AS phone
FROM app_storage AS app,
     json_each(app.value, '$.members') AS member
WHERE app.key = 'tgt_db_data';
```

Other preferences (such as the theme) are stored as separate key/value rows. The SQLite file is an internal persistence store, not a shared multi-user database: the app keeps its structured records together in a JSON snapshot rather than creating a separate SQL table for each type of record. Use the app's screens to change gym data. Avoid editing or deleting database values directly; malformed JSON or keys can prevent the app from loading correctly.

### Back up and transfer data

Close the desktop app before copying the database. Copy `gym-town.sqlite` to a safe backup location, and keep backups private because they contain member and business data. To restore, close the app and replace the database file in the same application-data folder with the backup. The desktop database is local to that Windows user and is not automatically synchronized with Netlify, another computer, or another Windows user account.
