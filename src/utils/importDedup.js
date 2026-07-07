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

// Fingerprint: bucket name (trimmed, case-insensitive) - "Food" and " food "
// are treated as the same bucket.
export const bucketFingerprint = (b) => (b.name || "").trim().toLowerCase();

// Fingerprint: the (bucket, category) pairing itself.
export const bucketAssignmentFingerprint = (a) => `${a.bucketId}:${a.category}`;
