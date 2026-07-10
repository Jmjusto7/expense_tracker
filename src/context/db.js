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
