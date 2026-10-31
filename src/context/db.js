// src/context/db.js
// Single source of truth for the Dexie schema. (Previously this schema was
// duplicated in a separate indexedDB.js file with an out-of-date version
// number - that file has been retired; this is the only db definition now.)
import Dexie from "dexie";
import { IMPORT_TABLES } from "../utils/importPlan";
import { newId, rekeyTables } from "../utils/rekey";

// Declares every schema version on `target`; exported so tests can build
// databases at older versions and upgrade them.
export function defineSchema(target, { upToVersion = Infinity } = {}) {
  target.version(4).stores({
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
  target.version(5).stores({
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
  target.version(6).stores({
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
  target.version(7).stores({
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
  target.version(8).stores({
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

  // Liabilities (see liability-plan.md): accounts gains four fields, all
  // unindexed like the account fields above - none of them are ever queried
  // by index, only read off rows already fetched by id, so no version bump.
  // - `isLiability`: bool, default false. Same `accounts` table as assets
  //   rather than a parallel table - deliberately, since almost every piece
  //   of balance math (getBalanceAsOf, addTransfer, syncShadowExpenseEntry)
  //   already works correctly for a liability with ZERO changes, as long as
  //   its balance is stored negative (0 = paid off, more negative = owe
  //   more) - a linked purchase already subtracts, a Transfer-in payment
  //   already adds, getTotalBalance already nets it into net worth for free.
  // - `creditLimit`: nullable number, plain mutable field (not a dated
  //   history - described as just "adjustable", not something needing a
  //   timeline the way price/balance do).
  // - `statementCutoffDay` / `dueDateOffsetDays`: advisory only. The actual
  //   cutoff date is a real dated fact the user logs each cycle (a new
  //   balanceEntries `type: "statementClose"`, a pure date marker with no
  //   amount - mirrors "reconciliation" in shape) rather than something
  //   computed, since real cutoff dates shift by a day or more around
  //   weekends/holidays in ways that vary by card issuer. statementCutoffDay
  //   is only used to prefill a suggested date when logging a new close -
  //   see suggestNextCutoffDate in balanceHelpers.js - never trusted as the
  //   authoritative source. dueDateOffsetDays IS a fixed, trusted offset
  //   (due date = logged cutoff + N days), since only the cutoff itself was
  //   flagged as variable.

  if (upToVersion < 9) return target;

  // v9: UUID primary keys so data from several devices can be merged without
  // id collisions (the `++id` schema still accepts explicit string keys), plus
  // a key/value `syncState` table for Google Drive sync bookkeeping.
  target
    .version(9)
    .stores({ syncState: "key" })
    .upgrade(async (tx) => {
      const arrays = await Promise.all(IMPORT_TABLES.map((name) => tx.table(name).toArray()));
      const rekeyed = rekeyTables(Object.fromEntries(IMPORT_TABLES.map((name, i) => [name, arrays[i]])));
      for (const name of IMPORT_TABLES) {
        await tx.table(name).clear();
        await tx.table(name).bulkAdd(rekeyed[name]);
      }
    });

  for (const name of IMPORT_TABLES) {
    target.table(name).hook("creating", (_primKey, obj) => {
      if (obj.id == null) obj.id = newId();
    });
  }

  return target;
}

export const db = defineSchema(new Dexie("ExpensesDB"));

// A newer app version (e.g. another tab after an update) is upgrading the
// schema: step aside so it isn't blocked, then reload into the new code.
db.on("versionchange", () => {
  db.close();
  window.location.reload();
});
