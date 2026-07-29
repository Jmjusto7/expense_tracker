// src/context/db.js
// Single source of truth for the Dexie schema. (Previously this schema was
// duplicated in a separate indexedDB.js file with an out-of-date version
// number - that file has been retired; this is the only db definition now.)
import Dexie from "dexie";

export const db = new Dexie("ExpensesDB");

db.version(4).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "++id, yearId, monthId, dayId, category, travelId, &[yearId+monthId+dayId+category]",

  travels: "++id, title, startDate, endDate",

  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",
});

// v5 adds the Assets feature: accounts (bank/cash/etc, each tracked
// independently of the expense hierarchy) and balanceEntries, which cover
// both "Add Income" (type: "income", a signed amount) and "Reconcile
// Balance" (type: "reconciliation", an absolute observed balance - a
// snapshot, not a stored delta, so backfilling an earlier reconciliation
// never leaves a later one's numbers stale - see accounts-feature-plan-v2).
db.version(5).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "++id, yearId, monthId, dayId, category, travelId, &[yearId+monthId+dayId+category]",

  travels: "++id, title, startDate, endDate",

  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",

  accounts: "++id, name",
  balanceEntries: "++id, accountId, date, type",
});

// v6 adds Account Types - user-adjustable classifications for accounts
// (Bank Account, Digital Bank, Investment, Time Deposit, etc.), the same
// "zero or one, always adjustable" relationship categories have with
// buckets. Unlike categories (freeform strings needing a separate
// bucketAssignments join table), accounts already have a real numeric id,
// so `typeId` lives directly on the account row - no join table needed.
db.version(6).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "++id, yearId, monthId, dayId, category, travelId, &[yearId+monthId+dayId+category]",

  travels: "++id, title, startDate, endDate",

  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",

  accounts: "++id, name, typeId",
  balanceEntries: "++id, accountId, date, type",
  accountTypes: "++id, name",
});

// v7 adds foreign-currency / investment asset tracking (see
// foreign-assets-plan.md). Two new nullable fields on accounts:
// - `unit`: null = ordinary PHP account (unchanged behavior). Set to
//   "USD"/"AAPL"/etc = this account holds units of that thing.
// - `costCurrencyAccountId`: null = priced directly in PHP. Set = priced
//   in whatever THAT account holds, chained through as many hops as
//   necessary (e.g. a stock account pointing at a USD wallet account).
// Both are set once at account creation and never edited afterward - see
// the plan doc for why. balanceEntries gains two new `type` values used
// by existing rows only when relevant ("convert" and "markPrice") plus
// three new nullable fields (costBasis, fee, pricePerUnit) - none of
// these are indexed, so no schema line changes for that table itself.
db.version(7).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "++id, yearId, monthId, dayId, category, travelId, &[yearId+monthId+dayId+category]",

  travels: "++id, title, startDate, endDate",

  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",

  accounts: "++id, name, typeId, unit, costCurrencyAccountId",
  balanceEntries: "++id, accountId, date, type",
  accountTypes: "++id, name",
});

// balanceEntries gains a fifth `type`: "transfer" - moves units between two
// of the user's own same-unit accounts (see ExpenseContext's addTransfer /
// balance-transfers-plan.md). Written as a signed-amount pair (negative on
// the source, positive on the destination) linked by a generated
// `transferGroupId`, plus `counterpartAccountId` on each leg for display.
// No version bump: same precedent as v7's costBasis/fee/pricePerUnit -
// these fields are never queried by index, only read off rows already
// fetched by accountId, so nothing here needs to appear in stores().

// v8 lets a transaction optionally be "Paid From" an Assets account (see
// linked-transactions-plan.md). Unlike the Transfer fields above, this
// DOES need a real index - removeAccount unlinks every transaction
// pointing at a deleted account via `db.transactions.where({ accountId })`,
// which requires accountId to be indexed. `accountId` is nullable/optional;
// most transactions are expected to stay unlinked (cash-in-pocket style).
//
// balanceEntries also gains a sixth `type`: "expense" - a shadow entry
// ExpenseContext.syncShadowExpenseEntry auto-generates (and fully
// regenerates on every edit, never patches) whenever a transaction is
// linked to an account, so the account's balance walk reflects the spend
// immediately without duplicating bookkeeping logic - see
// getInflowEntries in balanceHelpers.js. Carries a `sourceTransactionId`
// back-reference, looked up via .filter() rather than an index, same
// no-version-bump precedent as transferGroupId above.
db.version(8).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "++id, yearId, monthId, dayId, category, travelId, accountId, &[yearId+monthId+dayId+category]",

  travels: "++id, title, startDate, endDate",

  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",

  accounts: "++id, name, typeId, unit, costCurrencyAccountId",
  balanceEntries: "++id, accountId, date, type",
  accountTypes: "++id, name",
});
