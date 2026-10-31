# Pending improvements

Assessed 2026-10-31. Severity: H = high, M = medium, L = low.

Status: everything ticked below is implemented. Still open: section 2 (automatic prices, postponed),
recurring templates (postponed), and the steps only you can do - the Phase 0 phone sign-in check,
the Cloudflare deploy, adding the Google origin, and the on-device checks (see README).

## 0. Open questions

- [ ] What do you hold? US stocks/ETFs, PSE stocks, crypto, foreign cash only?
- [ ] OK to use a free Finnhub API key (stored on this device only) for US stock quotes?
- [ ] Price refresh: automatic on app open (when online, >6 h since last), or button only?
- [x] Assets grouping: flat groups by account type (each account once), or keep "Holdings" nesting under its pricing account? -> by type, Holdings nesting kept
- [x] Cloudflare Pages project name (decides the URL, e.g. `expense-tracker.pages.dev`) -> `expense-tracker`

## 1. Bugs

- [x] H - Date defaults use `toISOString().slice(0, 10)` (UTC). In the Philippines (UTC+8) forms show yesterday between 00:00 and 08:00 (AddIncomeModal, TransferModal, statement close, others). Use one local-date helper.
- [x] H - "Units Over Time" chart on foreign accounts shows units as pesos (`AccountBalanceChart` tooltip uses `formatCurrency`). Pass a unit-aware formatter.
- [x] H - `getCurrentValuePhp` derives the USD rate from the USD account's value / units held, so an empty USD account leaves a USD-priced stock unvalued. Use the reference account's latest price.
- [x] M - Totals use `getCurrentValuePhp(...) || 0`, so unknown valuations count as zero. Show "N accounts not valued".
- [x] M - Chart tooltips compare display names (`"Income"`) to lowercase keys (`"income"`) in IncomeExpense, MonthlySpend, AccountBalance, InvestmentGrowth. Match on `dataKey`.
- [x] M - Expense Analytics "Total Expenses" is computed from positive pie slices only, so it disagrees with Home/month totals when there are refunds.
- [x] M - MonthExpensesPage sorts `yearObj.months` in place during render (mutates context data). Sort a copy.
- [x] M - Editing a single transaction to a category already used that day throws a raw database error. Save through `saveDayTransactions` (merges) and allow changing the date.
- [x] L - Statement-close suggestion ignores the last logged close (can suggest a future or already-logged date).

## 2. Automatic prices (online pull, offline = last recorded)

Problem: prices are typed by hand per account, "Current Price" shows no date or source, stale prices silently drive net worth, and a buy at an odd rate becomes the current price.

| What | Source | Key | Limits |
| --- | --- | --- | --- |
| FX (USD->PHP etc.) | Frankfurter `api.frankfurter.dev/v2/rate/usd/php` | none | daily, no quotas |
| FX backup, crypto, metals | fawazahmed0 currency-api (jsDelivr, Cloudflare fallback) | none | daily, no limits |
| US stocks/ETFs | Finnhub free | free key | 60/min, US only |
| Alternative stocks | Twelve Data Basic | free key | 8/min, 800/day |
| PSE stocks | no reliable free source confirmed | - | stays manual |

- [ ] Per foreign account price source: `fx` (3-letter ISO unit), `stock` (ticker), `crypto`, `manual`; auto-detected from the unit, editable.
- [ ] Uppercase/trim units on save; allow editing unit/source after creation.
- [ ] Refresh on app open when online (reuse `useOnlineStatus`, section 8) and >6 h since the last refresh, plus a "Refresh prices" button on Assets.
- [ ] At most one automatic `markPrice` per account per day (update in place), tagged `source: "auto"` and `quotedAt`. A manual price beats auto for the same day.
- [ ] Offline or API error: write nothing, keep the last recorded price.
- [ ] Show "Price as of 29 Oct - auto/manual" per account; warn when older than ~3 trading days; add stale prices to the Home bell.
- [ ] API key entered in Settings, stored on this device only (not synced).

## 3. Assets and Liabilities layout

Today: cards in database order, nested only by "priced in" account, type is just a badge, no group totals, history charts above the accounts.

- [x] H - Group cards by account type (+ Unclassified) with a header: subtotal, count, share of total.
- [x] M - Collapsible groups (remember state, `aria-expanded`); sort by value (default), name, last reconciled.
- [x] M - Order: total + composition, then grouped accounts, then history charts.
- [x] M - Cards show price age and reconciliation age, plus an unknown-value warning.
- [x] M - Edit/delete visible on touch (no hover-only `opacity-0`); don't nest buttons inside the card `<Link>`.
- [x] M - Liabilities: same grouping/sort; sort by amount owed, credits shown separately.
- [x] L - Net worth line on Assets linking to Liabilities.

## 4. Charts (truncated / clipped data)

- [x] H - NetWorthHeroCard: fixed `w-[260px]` text column squeezes the chart; stack on mobile, give the chart a minimum height.
- [x] H - ImpliedSpendChart: every "account + date" label at -30 degrees with `interval={0}` overlaps; shorten labels, add account/range filter or horizontal scroll.
- [x] M - All line/bar charts: Y axis has no width/formatter, so large peso values clip. Compact ticks (`₱1.2M`), full values in tooltips.
- [x] M - MonthlySpendChart forces every month label flat (`interval={0}`); responsive tick density.
- [x] M - Pies: outside "name: amount" labels overflow on narrow screens; use a donut + wrapping legend/list. Allocation pie shows % only (names on hover) - add a legend.
- [x] M - Add legends to MonthlySpend, AccountBalance, InvestmentGrowth, ImpliedSpend.
- [x] M - State the period on each chart (Home 12 months, Assets all history, Investment Growth 12 months) and say when data is excluded.
- [x] M - QuickStats / BreakdownGrid truncate names and amounts with no way to see them; wrap or add a title tooltip.
- [x] L - Expense pie colours repeat after 8; stable per-category colours.

## 5. Travels

- [x] H - Sort trips by start date, newest first (currently database order).
- [x] H - Group by year of start date, with a yearly total; pin the current/upcoming trip.
- [x] M - Trip page "Add expense" prefilled with the trip and its dates; show the filtered-scope total next to the full-trip total.
- [x] M - Auto-select the trip when an expense date falls inside a trip's dates.
- [x] L - Add Travel start date defaults to today; clamp long comments on cards.

## 6. Friction

- [x] H - Add Transaction defaults to today even when today has entries; allow existing days in the month calendar (same-day rows already merge).
- [x] H - Statement close: suggest the next unlogged cutoff, flag overdue ones; "Make a payment" prefills the statement balance and last funding account.
- [x] H - Forms: inline errors instead of `alert()`, Esc closes, Ctrl/Cmd+Enter saves, Save disabled while saving.
- [x] M - Single-transaction edit can change the date.
- [x] M - Remember the last-used Paid From per session; "Add another" after saving income/price/transfer.
- [x] M - Home bell opens an attention list linking each stale asset or liability to its own page; Home cards link through to their pages.
- [x] M - Expense Analytics presets: this month, last month, this year.
- [x] M - "Delete day" action on the month page.
- [ ] M - Recurring templates (salary, subscriptions, loan payments) that create a prefilled draft to confirm. (postponed)
- [x] M - Convert: suggest units from the current price; warn when no funding source is set.
- [x] L - Blank starting balance = 0; open the account after creating it.
- [x] L - Category bucketing: search, rename buckets, unassigned categories first.
- [x] L - Confirm before Disconnect in Sync.

## 7. General UI consistency

- [x] H - Shared dialog component: `role="dialog"`, focus trap/restore, Esc, scroll lock, consistent widths, labelled inputs; full-screen sheet with a sticky Save on phones.
- [x] H - Settings: fixed `w-56` sidebar doesn't stack on mobile; tabs or a select below `md`.
- [x] H - Year/month cards are clickable `<div>`s and some toggles are hidden checkboxes; use real links/buttons.
- [x] M - Distinguish "loading" from "empty" on Home and list pages; first-use onboarding on an empty Home.
- [ ] M - One set of money/unit/count formatters (precision, sign placement, compact notation); `formatDate` everywhere. (partly: sign placement, compact chart ticks and unit formatting are shared; no full audit of every page yet)
- [x] M - Separate category/series colours from good/bad/pending colours; unpaid statements use one colour everywhere.
- [ ] L - Consistent page widths, card padding/radius, header spacing, breadcrumb semantics, Lucide icons only. (partly: Lucide icons only, phone padding on touched pages; widths not unified)

## 8. Mobile app: installable PWA + automatic Drive sync

Decisions: installable PWA only (no app store), Android Chrome only, hosted on **Cloudflare Pages** at its own origin (e.g. `https://expense-tracker.pages.dev`), `BrowserRouter` with clean URLs at base path `/`. Sync is automatic only while a Google token is already in memory (one tap about once an hour). Auto-sync conflicts never open a modal; they show "Needs input". Out of scope: background sync while closed, iOS, app stores, server-side auth.

Why Cloudflare Pages and not GitHub Pages: every `jmjusto7.github.io/*` site shares one origin, so any other Pages project could read this app's IndexedDB. Cloudflare Pages gives the app its own origin, serves the app for any unknown path (no `404.html` trick, no base path), and is free.

### Phase 0 - Spike (do first)
- [ ] Deploy the current build to Cloudflare Pages, install it on Android, and confirm the Google sign-in popup returns a token inside the installed (standalone) app. If it doesn't, auto-sync works only from a Chrome tab; adjust Phase 3 accordingly.

### Phase 1 - Installable app shell (works offline)
- [x] Add `vite-plugin-pwa` (a version that supports Vite 7) and `workbox-window`. `VitePWA({ registerType: "prompt", manifest: { name: "Expense Tracker", short_name: "Expenses", start_url: "/", scope: "/", display: "standalone", theme_color: "#1f6f5c", background_color: "#eff3ee", icons: 192, 512, 512 maskable }, workbox: { globPatterns: js,css,html,svg,png,woff2, navigateFallback: "index.html" } })`.
- [x] Generate `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png` from `public/favicon.svg`; delete `public/manifest.json` and the empty `public/service-worker.js` (the plugin generates both).
- [x] `src/components/UpdatePrompt.jsx` with `useRegisterSW` ("New version available - Reload"), rendered in `App.jsx`. Mock `virtual:pwa-register/react` in `src/test/setup.js` (confirm Vitest can resolve it).
- [x] Replace the Google Fonts `@import` in `src/index.css` with `@fontsource` packages (Fraunces, IBM Plex Sans 400/500/600, IBM Plex Mono 400/500/600) imported in `main.jsx`; same font-family names.
- [x] `<meta name="theme-color" content="#1f6f5c">` in `index.html`.
- [x] `db.on("versionchange")` closes the DB and reloads, so updates that bump the schema don't hang on an old tab.

### Phase 2 - Offline/online awareness
- [x] `src/hooks/useOnlineStatus.js` (`navigator.onLine` + `online`/`offline` events); Navbar shows an "Offline" badge; Sync shows "Offline - will sync when online" instead of failing.
- [x] `useDriveSync`: call `preloadGoogleSignIn()` again when the connection returns. (now in `SyncContext`)
- [x] On start call `navigator.storage?.persist?.()`; show `persisted()` in Settings > Sync ("Storage: persistent / may be cleared by browser").

### Phase 3 - Automatic sync
- [x] Unsynced changes = `hashRecord(hashTables(local)) !== hashRecord(state.base)` (the base already fingerprints the last upload; no new field). Expose `hasPendingChanges()`.
- [x] Change signal: a `dataVersion` counter bumped in `reloadHierarchy`/`reloadAssets`; no Dexie hooks.
- [x] No-op sync: skip the local clear+rewrite when nothing changed on Drive, and skip the upload when nothing changed locally.
- [x] `useAutoSync`: triggers on `online`, `visibilitychange` -> visible, and 30 s after the last change. Runs only if online, configured, `hasValidToken()`, not busy, no form or SyncModal open, and changes are pending (or `lastSyncedAt` older than ~15 min on online/visible, to pull). Never call `getAccessToken()` without a valid token. (implemented as `SyncProvider`/`useSync`)
- [x] One sync at a time: `navigator.locks.request("drive-sync", { ifAvailable: true }, ...)`, in-memory flag fallback.
- [x] Conflicts -> status "Needs input" (no modal); otherwise commit quietly -> "Synced". Auth error -> "Sign-in needed"; network error or "data changed during sync" -> "Pending", retry later. No toasts during auto runs.
- [x] Navbar sync indicator: Synced (time) / N unsynced or "Tap to sync" / Needs input / Offline / Syncing. Tapping runs the existing manual `startSync`. Mirror in Settings > Sync.
- [x] Keep the order: save locally, then upload.

### Phase 4 - Phone layout
- [x] Below `sm`: fixed bottom tab bar (Home, Expenses, Travels, Assets, Liabilities) with a floating "Add transaction" button; Import/Export/Sync/Settings in a "More" menu; content padded for the bar, `env(safe-area-inset-bottom)`. Desktop unchanged.
- [x] Month expenses as a card list on phones; `overflow-x-auto` wrappers for AccountDetail, LiabilityDetail, TravelDetail tables.
- [x] Add/Edit transaction: full-screen sheet on phones (`max-h-[100dvh]`, sticky Save), single-column rows; native `<input type="date">` on phones instead of `react-date-picker`.
- [ ] Check the Android keyboard offers a comma on amount fields (comma-separated breakdowns); avoid `inputmode="decimal"` if it hides it. (comma amount fields use a plain text keyboard; confirm on the phone)
- [x] AccountsPage actions: `opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100`. NetWorthHeroCard: `w-full sm:w-[260px] min-w-0`.
- [x] Export: `setTimeout(() => URL.revokeObjectURL(url), 1000)` instead of revoking immediately.

### Phase 5 - Deploy (Cloudflare Pages)
- [ ] Connect the GitHub repo in Cloudflare Pages: framework preset Vite, build command `npm run build`, output `dist`, environment variable `VITE_GOOGLE_CLIENT_ID` (public, not a secret). Or deploy manually: `npm run build && npx wrangler pages deploy dist`.
- [ ] Google Cloud console -> Clients -> add Authorized JavaScript origin `https://<project>.pages.dev`. Preview deployments get other subdomains: sign-in and local data won't carry over there; use the production URL on the phone.
- [x] README: "Install on Android" (Chrome menu -> Install app), how offline works, auto-sync rules (sign-in tap about once an hour, conflicts show "Needs input"), Cloudflare Pages build settings and the extra origin.

### Tests to add
- [x] `useOnlineStatus` reacts to online/offline events.
- [x] `sync.test.jsx`: `hasPendingChanges` false right after sync, true after an edit, still true after a failed upload; no-op sync doesn't rewrite or upload.
- [x] `useAutoSync` (mock `hasValidToken`, `prepareSync`, `commitSync`): runs on `online` with token + pending; does nothing offline, without a token, or with nothing pending; conflicts -> "Needs input" with no SyncModal; two triggers -> one `prepareSync`; never calls `getAccessToken` without a valid token.
- [x] All existing tests still pass.

### Checks
1. `npm run lint` (0 errors) and `npm test` (all green).
2. `npm run build && npm run preview` -> DevTools Application tab: manifest with icons, service worker active; Lighthouse says installable.
3. DevTools Network Offline: reload `/` and `/expenses/2026` -> both load with fonts; adding a transaction works.
4. Android on the Pages URL: install -> airplane mode -> add data -> close/reopen -> data there, badge shows unsynced -> online -> tap Sync once -> edit -> auto-sync finishes within ~30 s.
5. Two devices edit the same record -> phone shows "Needs input" -> tap -> SyncModal resolves it.
6. Deploy a trivial change -> installed app shows "New version" -> reload keeps the data.

## Suggested order

1. Section 1 bugs (UTC dates matter more on a phone)
2. Section 8 Phase 0 spike + Phase 1 shell + Phase 2 online awareness
3. Section 2 automatic prices (uses the online hook)
4. Section 8 Phase 3 auto-sync
5. Sections 3 and 5 (Assets grouping, Travels sort/group by year)
6. Section 8 Phase 4 + section 7 (phone layout, shared dialog)
7. Section 4 charts
8. Section 6 friction, then remaining medium/low items
9. Section 8 Phase 5 deploy (can happen any time after the Phase 0 spike)
