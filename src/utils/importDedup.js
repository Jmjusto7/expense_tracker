// src/utils/importDedup.js

// Groups items by a fingerprint function and returns only the groups that
// actually have more than one member. Each duplicate group resolves
// deterministically to { keep, remove }: keep is the most-recently-created
// item (by createdAt), remove is everything else in that group.
//
// Previously "highest-id item" (`sort((a, b) => b.id - a.id)`), which
// relied on ids being auto-incrementing numbers where a higher id reliably
// meant "created later." Under Dexie Cloud, primary keys are opaque
// globally-unique strings with no meaningful ordering - `b.id - a.id` on
// two strings is NaN, and a comparator returning NaN is treated as "equal"
// by Array.sort, silently making "keep" arbitrary (whatever order the
// items happened to be iterated in) instead of "the newest." createdAt is
// the only thing left that's actually meaningful to sort by - see the
// createdAt: new Date() stamp added to every record-creating call in
// ExpenseContext.jsx. Records with no createdAt (pre-migration legacy
// data that slipped through) sort as oldest (epoch 0) rather than
// throwing, so a bad/missing timestamp never crashes the import.
export function findDuplicateGroups(items, fingerprintFn) {
  const groups = new Map();

  for (const item of items) {
    const fp = fingerprintFn(item);
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(item);
  }

  const createdAtMs = (item) => (item.createdAt ? new Date(item.createdAt).getTime() : 0);

  const duplicates = [];
  for (const group of groups.values()) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => createdAtMs(b) - createdAtMs(a));
      duplicates.push({ keep: sorted[0], remove: sorted.slice(1) });
    }
  }
  return duplicates;
}

// Fingerprint: the year number itself - two year rows with the same
// `year` value (e.g. two separate exports each containing their own
// autoincrement row for "2026") are the same real-world year.
export const yearFingerprint = (y) => y.year;

// Fingerprint: (yearId, name) - matches the DB's own &[yearId+name]
// unique index. Must be computed *after* any year-id remapping has been
// applied, so months that now point at the same surviving year are
// correctly recognized as duplicates of each other.
export const monthFingerprint = (m) => `${m.yearId}:${m.name}`;

// Fingerprint: (yearId, monthId, day) - matches the DB's own
// &[yearId+monthId+day] unique index. Must be computed *after* both
// year-id and month-id remapping have been applied.
export const dayFingerprint = (d) => `${d.yearId}:${d.monthId}:${d.day}`;

// Fingerprint: bucket name (trimmed, case-insensitive) - "Food" and " food "
// are treated as the same bucket.
export const bucketFingerprint = (b) => (b.name || "").trim().toLowerCase();

// Fingerprint: account name (trimmed, case-insensitive) plus unit and
// liability flag - a PHP "Wallet" and a USD "Wallet" are different accounts.
export const accountFingerprint = (a) =>
  [(a.name || "").trim().toLowerCase(), a.unit ?? "", Boolean(a.isLiability)].join("|");

const dayString = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

// Fingerprint: trip title (trimmed, case-insensitive) plus start/end day.
export const travelFingerprint = (t) =>
  [(t.title || "").trim().toLowerCase(), dayString(t.startDate), dayString(t.endDate)].join("|");

// Fingerprint: account type name (trimmed, case-insensitive) - same
// treatment as buckets/accounts. Two exports each with their own
// "Investment" row are the same real-world classification.
export const accountTypeFingerprint = (t) => (t.name || "").trim().toLowerCase();

// Fingerprint: a balanceEntries row's full content. Covers all five shapes
// (income has `amount`; reconciliation has `balance`; convert has `amount`
// + `costBasis` + optional `fee`; markPrice has `pricePerUnit`; transfer
// has `amount` + `counterpartAccountId` - see foreign-assets-plan.md §2.2
// and balance-transfers-plan.md), so a content match only happens when
// account, date, type, and every relevant field all agree.
// `date` is normalized to a plain day string first - existing DB rows carry
// a real Date object, but freshly-imported rows are still whatever JSON.parse
// produced (a string), and those need to fingerprint identically for a
// cross-device duplicate to actually be recognized as one.
// `transferGroupId` is deliberately excluded - it's an arbitrary id
// generated at creation time, not a meaningful property of the transfer
// itself, so two independently-created (but content-identical) transfers
// would otherwise never be recognized as duplicates of each other.
export const balanceEntryFingerprint = (e) =>
  [
    e.accountId,
    new Date(e.date).toISOString().slice(0, 10),
    e.type,
    e.amount ?? "",
    e.balance ?? "",
    e.costBasis ?? "",
    e.fee ?? "",
    e.pricePerUnit ?? "",
    e.category || "",
    e.comments || "",
    e.type === "transfer" ? e.counterpartAccountId ?? "" : "",
  ].join("|");

// Fingerprint: the (bucket, category) pairing itself.
export const bucketAssignmentFingerprint = (a) => `${a.bucketId}:${a.category}`;
