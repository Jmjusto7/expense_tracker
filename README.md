# Expense Tracker

A personal finance tracker that runs entirely in the browser: daily expenses organized by
year → month → day, trips, category buckets, asset and liability accounts (including foreign
currencies and investments), transfers, and summary charts.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to watch) |

## Your data

- Everything is stored locally in your browser's IndexedDB (database `ExpensesDB`). Nothing
  leaves the browser unless you turn on Google Drive sync (below).
- Clearing site data, or using a different browser/device, means starting empty.
- **Backup = Export.** Use the export button in the top bar to download a JSON file of all data.
- **Before upgrading to the sync version, export a backup.** The first launch converts every
  record's ID to a UUID (needed so devices don't clash); exports made before that still import
  fine and get new IDs on the way in.

## Importing

Import reads an exported JSON file (max 25 MB), validates it, and shows a preview before
anything is written. The whole import is applied in a single transaction - if anything fails,
your existing data is left unchanged.

- Records with the same ID as existing ones are overwritten.
- Duplicates are merged automatically: years, months, days, trips (title + dates), buckets,
  accounts (name + currency + liability), account types, identical balance entries, and
  transactions on the same day and category with the **same** amount (the newest is kept).
- Transactions on the same day and category with **different** amounts are listed in the
  preview; choose *Keep existing*, *Keep imported*, or *Merge* (amounts and comments combined;
  only available when the trip/account tags don't conflict) for each before importing.

## Google Drive sync (optional, free)

Press **Sync** in the top bar (or *Settings → Sync*) on each device. The app keeps one file,
`tracker-sync.json`, in a hidden app-only folder of your Google Drive and merges it with this
device's data:

- Changes made on only one device are applied on the other, including deletions.
- An entry changed on both devices since the last sync, or deleted on one and changed on the
  other, is shown for you to choose which version to keep.
- Same day + category with different amounts gets the same *Keep / Keep / Merge* choice as import.
- Sync only runs when you press the button. The Google sign-in token is kept in memory only.
- *Clear DB* resets this device; the next sync brings the Drive copy back.

### One-time Google Cloud setup (no cost)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project.
2. *APIs & Services → Library*: enable the **Google Drive API**.
3. *Google Auth Platform → Branding / Audience*: user type **External**; add your own Gmail
   address as a **test user**.
4. *Data access*: add the scope `https://www.googleapis.com/auth/drive.appdata` (non-sensitive -
   the app can only see its own hidden folder, not your files).
5. *Clients → Create client*: type **Web application**; authorized JavaScript origin
   `http://localhost:5173` (add your hosted URL here later).
6. Copy `.env.example` to `.env.local`, paste the client ID into `VITE_GOOGLE_CLIENT_ID`, and
   restart `npm run dev`.

While the app is in *Testing*, Google may occasionally ask you to approve access again. Because
the only scope is non-sensitive, you can publish it (*Audience → Publish app*) without a review.

To try sync on one computer, use two Chrome profiles - each has its own local database.
