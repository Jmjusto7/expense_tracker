// src/utils/importDedup.js

// Groups items by a fingerprint function and returns only the groups that
// actually have more than one member. Each duplicate group resolves
// deterministically to { keep, remove }: keep is the highest-id item,
// remove is everything else in that group.
export function findDuplicateGroups(items, fingerprintFn) {
  const groups = new Map();

  for (const item of items) {
    const fp = fingerprintFn(item);
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(item);
  }

  const duplicates = [];
  for (const group of groups.values()) {
    if (group.length > 1) {
      const sorted = [...group].sort((a, b) => b.id - a.id);
      duplicates.push({ keep: sorted[0], remove: sorted.slice(1) });
    }
  }
  return duplicates;
}

// Maps dayId -> { year, monthName, day } so a transaction's fingerprint can
// use the *semantic* period (year number / month name / day number)
// instead of its yearId/monthId/dayId - two transactions from different
// devices/exports can describe the same real day under different ids.
export function buildDayLookup(years, months, days) {
  const yearById = Object.fromEntries(years.map((y) => [y.id, y.year]));
  const monthById = Object.fromEntries(months.map((m) => [m.id, m]));

  const lookup = {};
  for (const d of days) {
    const month = monthById[d.monthId];
    lookup[d.id] = {
      year: yearById[d.yearId],
      monthName: month?.name,
      day: d.day,
    };
  }
  return lookup;
}

// Fingerprint: year, month, day, category, amount, comments, breakdown,
// and travel reference - two transactions matching on all of these are
// treated as the same real-world expense, regardless of id.
export function transactionFingerprint(t, dayLookup) {
  const period = dayLookup[t.dayId] || {};
  const breakdown = Array.isArray(t.amountBreakdown) ? t.amountBreakdown.join(",") : "";
  return [
    period.year,
    period.monthName,
    period.day,
    t.category,
    t.amount,
    t.comments || "",
    breakdown,
    t.travelId ?? "null",
  ].join("|");
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

// Fingerprint: account name (trimmed, case-insensitive) - same treatment as
// buckets. Two exports each with their own "Bank A" row are the same
// real-world account.
export const accountFingerprint = (a) => (a.name || "").trim().toLowerCase();

// Fingerprint: account type name (trimmed, case-insensitive) - same
// treatment as buckets/accounts. Two exports each with their own
// "Investment" row are the same real-world classification.
export const accountTypeFingerprint = (t) => (t.name || "").trim().toLowerCase();

// Fingerprint: a balanceEntries row's full content. Covers both shapes
// (income has `amount`, reconciliation has `balance` - see
// accounts-feature-plan-v2.md §1.1), so a content match only happens when
// account, date, type, and the relevant value/category/comments all agree.
// `date` is normalized to a plain day string first - existing DB rows carry
// a real Date object, but freshly-imported rows are still whatever JSON.parse
// produced (a string), and those need to fingerprint identically for a
// cross-device duplicate to actually be recognized as one.
export const balanceEntryFingerprint = (e) =>
  [
    e.accountId,
    new Date(e.date).toISOString().slice(0, 10),
    e.type,
    e.amount ?? "",
    e.balance ?? "",
    e.category || "",
    e.comments || "",
  ].join("|");

// Fingerprint: the (bucket, category) pairing itself.
export const bucketAssignmentFingerprint = (a) => `${a.bucketId}:${a.category}`;
