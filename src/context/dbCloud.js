// src/context/dbCloud.js
//
// Cloud-synced counterpart to db.js. Deliberately a SEPARATE Dexie
// database ("ExpensesCloudDB") rather than an in-place upgrade of the
// existing "ExpensesDB" - IndexedDB can't relabel an object store's
// keyPath from number (++id) to string (@id) via a version upgrade, so
// converting in place would mean dropping and recreating every table
// anyway. Keeping the old local-only db untouched also means it stays
// available as a known-good fallback/backup source until the migration
// (see importDedup.js-based migration script, Phase 3) has been run and
// verified.
//
// Every table's primary key changes from '++id' to '@id': Dexie Cloud
// generates a globally-unique string id instead of a local auto-increment
// number, which is required so that two devices creating records offline
// at the same time can never collide (two auto-increment ints starting
// from 1 on two different phones absolutely would). See db.cloud.schema
// docs: https://dexie.org/cloud/docs/db.cloud.schema
//
// IMPORTANT - downstream impact: every id in this app (yearId, monthId,
// dayId, travelId, accountId, bucketId, costCurrencyAccountId,
// counterpartAccountId, sourceTransactionId, transferGroupId) becomes an
// opaque string instead of a number once records are created against this
// schema. Anywhere the codebase currently does Number(someId) on a value
// that came from this db needs to stop doing that - see the running list
// in ExpenseContext.jsx (to be updated), AccountSelectCell.jsx,
// TravelSelectCell.jsx, AccountTypeSelectCell.jsx, HierarchyGuard.jsx.
import Dexie from "dexie";
import dexieCloud from "dexie-cloud-addon";

export const dbCloud = new Dexie("ExpensesCloudDB", { addons: [dexieCloud] });

// Secondary indexes carried over unchanged from db.js v8 - only the
// primary key marker (++ -> @) actually needs to change. Compound indexes
// like &[yearId+monthId+dayId+category] still work the same way once the
// referenced ids are strings instead of numbers; Dexie doesn't care about
// the type, only that whatever's stored there is consistent.
dbCloud.version(1).stores({
  years: "@id, year",
  months: "@id, yearId, name, &[yearId+name]",
  days: "@id, yearId, monthId, day, &[yearId+monthId+day]",

  transactions:
    "@id, yearId, monthId, dayId, category, travelId, accountId, &[yearId+monthId+dayId+category]",

  travels: "@id, title, startDate, endDate",

  buckets: "@id, name",
  bucketAssignments: "@id, bucketId, category",

  accounts: "@id, name, typeId, unit, costCurrencyAccountId",
  balanceEntries: "@id, accountId, date, type",
  accountTypes: "@id, name",
});

// databaseUrl comes from `npx dexie-cloud create` (Phase 1) - paste the
// URL it prints here. requireAuth: true means the app won't read/write
// until the user has signed in (email OTP by default) - see Phase 4 for
// the login screen this implies is needed.
dbCloud.cloud.configure({
  databaseUrl: "https://YOUR-DATABASE-ID.dexie.cloud", // TODO: replace after `npx dexie-cloud create`
  requireAuth: true,
});
