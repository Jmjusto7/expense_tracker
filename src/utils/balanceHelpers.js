// src/utils/balanceHelpers.js
//
// Derived computations for the Assets feature. Nothing here is stored -
// every function walks the raw `balanceEntries` array fresh. This is
// deliberate: it's what makes backfilling an earlier reconciliation safe
// (see accounts-feature-plan-v2.md §1) - insert a Feb entry after March
// already exists, and the very next call to any of these functions
// reflects it correctly, with no separate "recompute" step anywhere.
//
// Entry shape (see db.js v5):
//   { id, accountId, date, type: "income" | "reconciliation",
//     amount, balance, category, comments }
// - "income"        -> `amount` is set (signed, normally positive), `balance` is null
// - "reconciliation" -> `balance` is set (the absolute observed balance), `amount` is null

// Truncates a Date (or date-like value) to a day-precision timestamp, so
// entries logged on the same calendar day compare equal regardless of any
// incidental time-of-day component.
const toDayTimestamp = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

// Chronological order for one account's entries, with id as a tie-break
// for same-day entries. The id tie-break matters because two entries
// dated the same day still have a real "which happened first" order -
// autoincrement id is the closest proxy we have to that.
const sortEntriesChrono = (entries) =>
  [...entries].sort((a, b) => {
    const ta = toDayTimestamp(a.date);
    const tb = toDayTimestamp(b.date);
    return ta !== tb ? ta - tb : a.id - b.id;
  });

export function getAccountEntriesSorted(entries, accountId) {
  return sortEntriesChrono(entries.filter((e) => e.accountId === accountId));
}

export function getReconciliations(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "reconciliation");
}

export function getIncomeEntries(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "income");
}

// The most recent reconciliation at or before `asOfDate` - the "ground
// truth" figure that every balance calculation builds forward from.
// Returns null if the account has no reconciliation yet (shouldn't
// normally happen - addAccount always creates one as the starting
// balance - but guarded rather than assumed).
export function getAnchor(entries, accountId, asOfDate) {
  const asOfTs = toDayTimestamp(asOfDate);
  let anchor = null;
  for (const r of getReconciliations(entries, accountId)) {
    if (toDayTimestamp(r.date) <= asOfTs) anchor = r;
    else break; // list is chronological - nothing later can qualify either
  }
  return anchor;
}

// Sum of income entries strictly after `anchor` (by the same
// chronological+id ordering) and at or before `asOfDate`.
const sumIncomeSinceAnchor = (entries, accountId, anchor, asOfDate) => {
  const asOfTs = toDayTimestamp(asOfDate);
  const anchorTs = toDayTimestamp(anchor.date);

  return getIncomeEntries(entries, accountId)
    .filter((e) => {
      const eTs = toDayTimestamp(e.date);
      if (eTs !== anchorTs) return eTs > anchorTs && eTs <= asOfTs;
      return e.id > anchor.id && eTs <= asOfTs; // same-day tie-break
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
};

// Balance(X) = anchor.balance + income logged since the anchor, up to X.
// Returns null if there's no reconciliation to anchor from at all.
export function getBalanceAsOf(entries, accountId, asOfDate) {
  const anchor = getAnchor(entries, accountId, asOfDate);
  if (!anchor) return null;
  return anchor.balance + sumIncomeSinceAnchor(entries, accountId, anchor, asOfDate);
}

// "Current balance" - if the anchor is stale, this is a projection
// ("assuming no untracked spending since it was last reconciled"). Pair
// with daysSinceLastReconciliation() in the UI to flag that honestly
// rather than presenting it as fact.
export function getCurrentBalance(entries, accountId, now = new Date()) {
  return getBalanceAsOf(entries, accountId, now);
}

export function getTotalBalance(accounts, entries, now = new Date()) {
  return accounts.reduce((sum, acc) => sum + (getCurrentBalance(entries, acc.id, now) || 0), 0);
}

// One point per trailing month (default 12), each the total balance as of
// that month's last day - the series behind the Home dashboard's Net Worth
// hero chart. Reuses getTotalBalance per month-end rather than tracking a
// running total, so it stays correct under the same backfill-safety
// guarantee as everything else here (nothing cached, always recomputed).
export function buildMonthlyNetWorth(accounts, entries, monthsBack = 12, endDate = new Date()) {
  const rows = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    rows.push({
      date: monthDate,
      netWorth: getTotalBalance(accounts, entries, monthEnd),
    });
  }
  return rows;
}

// One row per gap between two consecutive reconciliations on the same
// account. `impliedSpend` > 0 means the account lost more than its logged
// income accounts for (untracked spend); < 0 means it gained more (missed
// income log, interest, etc.) - see accounts-feature-plan-v2.md §1.3/§3.
export function getImpliedSpendPeriods(entries, accountId) {
  const reconciliations = getReconciliations(entries, accountId);
  const periods = [];

  for (let i = 0; i < reconciliations.length - 1; i++) {
    const from = reconciliations[i];
    const to = reconciliations[i + 1];
    const incomeInPeriod = sumIncomeSinceAnchor(entries, accountId, from, to.date);
    const expected = from.balance + incomeInPeriod;

    periods.push({
      fromDate: from.date,
      toDate: to.date,
      fromBalance: from.balance,
      toBalance: to.balance,
      incomeInPeriod,
      expected,
      impliedSpend: expected - to.balance,
    });
  }

  return periods;
}

// How many days old the latest reconciliation is - drives the "as of
// [date], projected forward" staleness flag on AccountDetailPage. Returns
// null if there's no reconciliation at all.
export function daysSinceLastReconciliation(entries, accountId, now = new Date()) {
  const reconciliations = getReconciliations(entries, accountId);
  if (reconciliations.length === 0) return null;
  const last = reconciliations[reconciliations.length - 1];
  return Math.round((toDayTimestamp(now) - toDayTimestamp(last.date)) / (1000 * 60 * 60 * 24));
}

// Guard for deletion: an account's earliest reconciliation anchors its
// entire balance history - nothing before it, so removing it would leave
// every calculation with no starting point. Delete the account itself
// instead if that's really the intent.
export function isOldestReconciliation(entries, accountId, entryId) {
  const reconciliations = getReconciliations(entries, accountId);
  return reconciliations.length > 0 && reconciliations[0].id === entryId;
}
