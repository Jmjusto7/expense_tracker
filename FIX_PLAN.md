# Expense Tracker – Fix Plan (handover)

Repo: https://github.com/Jmjusto7/expense_tracker
Stack: React 19, Vite 7, Tailwind 4, React Router 7, Dexie 4 (IndexedDB `ExpensesDB`), Recharts. No backend. Line numbers below are approximate (as of analysis on 2026-10-30).

## Confirmed decisions

| Topic | Decision |
|---|---|
| Deleting an account with transfers/linked converts | **Detach**: keep the other account's surviving leg (its balance stays correct), null `counterpartAccountId` + `transferGroupId`, append "(counterpart account '<name>' deleted)" to comments |
| Import: two different transactions remap onto same day+category | **Equal amount → auto-dedupe** (keep newest). **Unequal → prompt user** in import preview: keep existing / keep imported / merge |
| `addTransaction` merge where travel/account tags differ | **Block with error** |
| Amount input syntax | **Keep comma separator, strict** validation + live preview |
| Filter persistence | **sessionStorage** |
| Tests | **Yes** – Vitest + fake-indexeddb + @testing-library/react |

Out of scope: data encryption, CSV import, splitting `ExpenseContext.jsx`.

---

## Phase 0 – Test harness (do first)

1. `npm i -D vitest jsdom fake-indexeddb @testing-library/react`
2. `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
3. `vite.config.js`: add `test: { environment: "jsdom", setupFiles: ["./src/test/setup.js"] }`
4. `src/test/setup.js`: `import "fake-indexeddb/auto";` plus `afterEach` that clears every `db.tables` (or `db.delete()` + `db.open()`).
5. Helper `src/test/renderContext.jsx`: `renderHook(() => useExpenseContext(), { wrapper: ExpenseProvider })` and wait for `isLoaded` (added in B1).
6. ESLint: add vitest globals for `**/*.test.{js,jsx}` in `eslint.config.js`.

Write each test alongside its fix (listed per item below).

---

## Phase A – Data integrity

### A1. Atomic multi-step writes
Problem: writes are sequential awaits; a mid-way failure leaves partial state.

- Wrap in `db.transaction("rw", db.tables, async () => { ... })`, then reload state **once** after commit:
  - `commitImport` + duplicate cleanup (`ExpenseContext.jsx` ~L1490)
  - `removeAccount` (~L503), `addTransfer` (~L830), `removeYear` / `removeMonth` / `removeDay` (~L140–195), `clearDB`
- Inside a Dexie transaction only await Dexie promises (no `file.text()`, no fetch). Calling other context methods that do `db.*` is fine; their internal `reloadHierarchy()` calls should be skipped inside the batch (add an internal non-reloading variant or a `skipReload` flag) to avoid N reloads.
- New context action `saveDayTransactions({ yearId, monthId, dayId, deletes, upserts })` – one transaction: delete rows (+ shadow cleanup via `syncShadowExpenseEntry`), add/update rows, remove the day if empty. Replace the loops in:
  - `AddTransactionModal.jsx` `handleSave` (~L86)
  - `EditTransactionModal.jsx` `handleSave` (~L77)
  - Both modals must validate **all** rows (amount parse, tag conflicts) **before** calling it.
- `Navbar.jsx` ~L79 message "your existing data was not changed" becomes true – keep it.

Tests: force a failure mid-operation (e.g. `vi.spyOn(db.balanceEntries, "bulkPut").mockRejectedValue(...)`) and assert all tables unchanged, for `commitImport`, `saveDayTransactions`, `removeAccount`, `addTransfer`.

### A2. Import plan + conflict prompt
Problem: dedup runs after writes, drops non-identical same-day/category rows silently, dedups accounts by name only, has no travel dedup, and dedups transactions **before** account remap (misses dupes that differ only by duplicate account id).

- New pure module `src/utils/importPlan.js`: `planImport(existing, incoming)` where both are `{ years, months, days, transactions, travels, buckets, bucketAssignments, accounts, balanceEntries, accountTypes }`.
  - Simulate `bulkPut` in memory (incoming overwrites by id).
  - Order: accountTypes → accounts → travels → buckets/assignments → years → months → days → transactions → balanceEntries.
  - Remap FKs after each step (`typeId`, `costCurrencyAccountId`, `accountId` on tx + balance entries, `counterpartAccountId`, `travelId`, `bucketId`, `yearId`/`monthId`/`dayId`).
  - Fingerprints (`importDedup.js`):
    - `accountFingerprint`: name (trim/lower) + `unit ?? ""` + `isLiability`
    - new `travelFingerprint`: title (trim/lower) + startDate day + endDate day
  - Day+category collision after remap:
    - equal `amount` → dedupe, keep newest `createdAt`
    - unequal → push to `conflicts: [{ key, existing, incoming }]`
  - Return `{ result /* final table arrays */, deletes /* per table ids */, summary /* counts */, conflicts }`.
  - Shadow `expense` balance entries of removed transactions must be dropped (current logic ~L1330).
- `parseImportFile` returns `{ data, counts, plan }` (reads existing tables, calls `planImport`).
- `ImportPreviewModal.jsx`: list conflicts (date, category, existing vs incoming amount/comments/tags) with radio: Keep existing / Keep imported / Merge (concat `amountBreakdown`, join comments with "; ", tags must match or Merge is disabled). Confirm disabled until every conflict resolved.
- `commitImport(plan, resolutions)`: apply resolutions to `plan.result`, then in one transaction `bulkDelete` + `bulkPut` per table.
- Remove `cleanupDuplicatesAfterImport` (and its stale "keeping the highest-id" header comment).

Tests (`importPlan.test.js`, pure): re-importing own export = no-op; two-device years/months/days merge; equal-amount collision deduped; unequal → conflict; same-name accounts with different units not merged; duplicate account remaps tx `accountId` before tx dedup; travel dedup remaps `travelId`; transfer `counterpartAccountId` remapped. Integration: conflict resolutions applied correctly.

### A3. Stricter import validation (`src/utils/importValidation.js`)
- Reject files > 25 MB in `parseImportFile` before `file.text()`.
- Type checks: `amount`, `balance`, `costBasis`, `fee`, `pricePerUnit`, `year`, `day` finite numbers when present; `date`, `startDate`, `endDate` parseable; `name`/`category`/`title` strings; `months.name` in `ALL_MONTHS`; balance entry `type` in known set (`income, reconciliation, convert, markPrice, transfer, expense, statementClose`).
- Referential checks against file ∪ existing DB: months→years, days→months/years, transactions→days, assignments→buckets, balanceEntries→accounts.

Tests: each rule rejects with a descriptive message; a valid export passes.

### A4. `removeAccount` (`ExpenseContext.jsx` ~L503)
- Inside one transaction:
  1. If any other account has `costCurrencyAccountId === accountId` → throw `"Can't delete: <names> are priced in this account. Reassign or delete them first."`
  2. For this account's entries with `transferGroupId`, find counterpart legs in other accounts → update `{ counterpartAccountId: null, transferGroupId: null, comments: comments + " (counterpart account '<name>' deleted)" }`.
  3. `cascadeRemoveFeeContributions(idsOfDeletedEntries)`.
  4. Delete entries, unlink transactions, delete account.
- UI: `AccountDetailPage.jsx` ~L145 and `LiabilityDetailPage.jsx` ~L153 must render a fallback label when `counterpartAccountId` is null; surface the thrown error in the delete UI.

Tests: counterpart balance unchanged after delete; fee transaction cleaned; blocked when another account is priced in it.

### A5. Tag conflict on merge (`addTransaction` ~L250)
- If existing row exists and both `travelId`s non-null and different, or both `accountId`s non-null and different → throw `"<category> on <date> is already tagged to <trip/account>. Use a different category or edit the existing entry."`
- Same check inside `saveDayTransactions`, and across rows in the same modal session (two rows, same category, different tags).

Tests: conflicting tags throw and write nothing; null + value still merges (adopts the value).

---

## Phase B – Bugs / UX friction

### B1. Deep-link hydration race
- `ExpenseProvider`: `isLoaded` state, set true after both initial `reloadHierarchy()` and `reloadAssets()` resolve; expose in context.
- `HierarchyGuard.jsx`: if `!isLoaded` render a loading placeholder (don't navigate). After load, missing year → `/expenses`, missing travel → `/travels`, etc. (drop the `years.length === 0 → "/"` redirect).
- Tests: render guard at `/expenses/2026/March` with seeded DB → stays; unknown year → `/expenses`.

### B2. Stale `matches` (`FilterContext.jsx` ~L63)
- Add `travelDrillBucketId` to `matches` deps (or memoize `filterState` and depend on it).
- Test: changing `travelDrillBucketId` changes `matches` result.

### B3. Strict amount parsing (`src/utils/amountHelpers.js`)
- `parseAmountExpression` returns `{ total, breakdown, error }`.
- Each comma token must match `/^-?(\d+(\.\d+)?|\.\d+)$/`; empty tokens (`"1,,2"`, trailing comma) → error.
- Zero-valued token → error `"Did you mean 1000? Commas separate amounts."` (construct suggestion by joining tokens when a zero token follows).
- Total 0 → error. Negatives allowed (refunds).
- Live preview under amount inputs in `AddTransactionModal`, `EditTransactionModal`, `EditSingleTransactionModal`: `= 150 + 200.5 → 350.5` or the error.
- Tests: valid cases, `"1,000"`, `"1,,2"`, `"-"`, `"."`, `"0"`, `"abc"`, negatives.

### B4. Transfer fee ≥ amount
- `TransferModal.jsx` ~L54 and `addTransfer`: require `fee < amount`.
- Test: `addTransfer` throws, nothing written.

### B5. Persist filters (`FilterContext.jsx`)
- Lazy-init state from `sessionStorage["tracker.filters"]` (dates as ISO strings → `Date`); write on change; `clearFilters` removes key. Ignore malformed stored JSON.
- Test: state survives provider remount.

---

## Phase C – Housekeeping
1. `routes.jsx`: catch-all `<Route path="*" element={<NotFoundPage />} />` (new `src/pages/NotFoundPage.jsx` with link Home).
2. `SettingsPage.jsx` ~L12, ~L45: remove "Presets" / "Others" placeholder tabs.
3. `package.json`: remove unused `date-fns`, `react-day-picker`. Remove unused `getTravelTransactions` from context + value object.
4. `index.html`: title "Expense Tracker"; replace `/vite.svg` favicon with an app SVG in `public/`.
5. `README.md`: replace Vite template – purpose, `npm install`, scripts (`dev/build/lint/test/preview`), data is local IndexedDB only, backup = JSON export, import behavior (dedup + conflict prompt).

---

## Verification
- `npm run lint`, `npm test`, `npm run build` all pass.
- Manual smoke: refresh `/expenses/<year>/<Month>` stays put; import own export twice → no changes; conflicting import shows prompt; delete account with transfer → other balance unchanged; `"1,000"` rejected; fee ≥ amount rejected; filters survive reload; unknown URL shows Not Found.

## Suggested commit order
Phase 0 → A1 → A5 → B3 → A4 → A2 → A3 → B1 → B2 → B4 → B5 → C. (A1 first because A2/A4/A5 build on the batched write path.)
