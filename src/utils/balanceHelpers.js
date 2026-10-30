// src/utils/balanceHelpers.js
//
// Derived computations for the Assets feature. Nothing here is stored -
// every function walks the raw `balanceEntries` array fresh. This is
// deliberate: it's what makes backfilling an earlier reconciliation safe
// (see accounts-feature-plan-v2.md §1) - insert a Feb entry after March
// already exists, and the very next call to any of these functions
// reflects it correctly, with no separate "recompute" step anywhere.
//
// Entry shape (see db.js v7, and foreign-assets-plan.md for the full story):
//   { id, accountId, date, type, amount, balance, costBasis, fee,
//     pricePerUnit, category, comments }
// - "income"         -> `amount` set (units received, PHP accounts only). `balance`/`costBasis`/`pricePerUnit` null.
// - "convert"        -> `amount` set (units received) + `costBasis` set (cost-currency spent for this batch,
//                        PHP for a one-hop account, another tracked currency for a two-hop account) + optional `fee`.
// - "reconciliation" -> `balance` set (the absolute observed units held, a snapshot not a delta).
// - "markPrice"      -> `pricePerUnit` set (this account's cost-currency per unit, as of `date`).
//
// Account shape relevant here (see db.js v7):
//   { id, name, typeId, unit, costCurrencyAccountId }
// - `unit` null            -> ordinary PHP account, everything below is a no-op/identity for it.
// - `unit` set              -> holds units of something else (USD, AAPL, ...).
// - `costCurrencyAccountId` null   -> priced directly in PHP (e.g. a USD wallet).
// - `costCurrencyAccountId` set    -> priced in whatever THAT account holds (e.g. a stock priced in USD),
//                                     chained through as many hops as necessary.

// Truncates a Date (or date-like value) to a day-precision timestamp, so
// entries logged on the same calendar day compare equal regardless of any
// incidental time-of-day component.
const toDayTimestamp = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

// Chronological order for one account's entries. Same-day entries still
// have a real "which happened first" order - creation time is the proxy,
// with the (random UUID) id only as a stable last resort.
const createdAtMs = (e) => (e.createdAt ? new Date(e.createdAt).getTime() : 0);
const compareSameDay = (a, b) => createdAtMs(a) - createdAtMs(b) || String(a.id).localeCompare(String(b.id));

const sortEntriesChrono = (entries) =>
  [...entries].sort((a, b) => {
    const ta = toDayTimestamp(a.date);
    const tb = toDayTimestamp(b.date);
    return ta !== tb ? ta - tb : compareSameDay(a, b);
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

export function getConvertEntries(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "convert");
}

export function getMarkPriceEntries(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "markPrice");
}

// Transfer entries always come in a same-unit pair (see ExpenseContext's
// addTransfer) - a negative-amount leg on the source account, a
// positive-amount leg on the destination, linked by transferGroupId.
// Exposed mainly for display (AccountDetailPage's counterpart note); the
// balance-walk below folds them into getInflowEntries since they're
// already signed correctly either direction.
export function getTransferEntries(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "transfer");
}

// Entries that add units to an account - "income" (PHP accounts),
// "convert" (accounts with a unit), "transfer" (either direction, already
// signed - a negative amount here is a transfer OUT), and "expense"
// (always negative - the shadow entry ExpenseContext.syncShadowExpenseEntry
// auto-generates for a transaction linked via "Paid From", see
// linked-transactions-plan.md) are different *meanings* (see the file
// header) but the same *mechanic* for the units-held walk below. Kept
// separate from getIncomeEntries, which callers outside this file (the
// income-vs-expense dashboard reporting in particular) rely on meaning
// literally "income" - a currency conversion, a transfer between your own
// accounts, or a linked transaction's spend isn't income and must not be
// counted as some in that reporting (nor would a linked transaction's
// amount be double-counted as an "expense" there either - that reporting
// reads straight from the transactions hierarchy already, not from here).
const getInflowEntries = (entries, accountId) =>
  getAccountEntriesSorted(entries, accountId).filter(
    (e) => e.type === "income" || e.type === "convert" || e.type === "transfer" || e.type === "expense"
  );

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

// Sum of unit-inflow entries (income or convert) strictly after `anchor`
// (by the same chronological+id ordering) and at or before `asOfDate`.
const sumInflowSinceAnchor = (entries, accountId, anchor, asOfDate) => {
  const asOfTs = toDayTimestamp(asOfDate);
  const anchorTs = toDayTimestamp(anchor.date);

  return getInflowEntries(entries, accountId)
    .filter((e) => {
      const eTs = toDayTimestamp(e.date);
      if (eTs !== anchorTs) return eTs > anchorTs && eTs <= asOfTs;
      return compareSameDay(e, anchor) > 0 && eTs <= asOfTs; // same-day tie-break
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
};

// Balance(X) = anchor.balance + units logged (income or convert) since the
// anchor, up to X. Returns null if there's no reconciliation to anchor
// from at all.
export function getBalanceAsOf(entries, accountId, asOfDate) {
  const anchor = getAnchor(entries, accountId, asOfDate);
  if (!anchor) return null;
  return anchor.balance + sumInflowSinceAnchor(entries, accountId, anchor, asOfDate);
}

// "Current balance" - if the anchor is stale, this is a projection
// ("assuming no untracked spending since it was last reconciled"). Pair
// with daysSinceLastReconciliation() in the UI to flag that honestly
// rather than presenting it as fact.
export function getCurrentBalance(entries, accountId, now = new Date()) {
  return getBalanceAsOf(entries, accountId, now);
}

export function getTotalBalance(accounts, entries, now = new Date()) {
  return accounts.reduce((sum, acc) => sum + (getCurrentValuePhp(entries, accounts, acc.id, now) || 0), 0);
}

// Most recent of (an explicit markPrice entry, the rate implied by the
// most recent convert entry: costBasis / units) at or before asOfDate -
// see foreign-assets-plan.md §2.2. Returns null if neither exists yet.
// This is deliberately "whichever is more recent", not "prefer markPrice"
// - every conversion already tells the system the rate at that moment, so
// you only need to explicitly Update Price on days you're checking
// valuation without actually transacting.
export function getLatestPrice(entries, accountId, asOfDate = new Date()) {
  const asOfTs = toDayTimestamp(asOfDate);

  const candidates = getAccountEntriesSorted(entries, accountId).filter(
    (e) => (e.type === "markPrice" || e.type === "convert") && toDayTimestamp(e.date) <= asOfTs
  );
  if (candidates.length === 0) return null;

  const latest = candidates[candidates.length - 1]; // chronological order preserved by filter
  if (latest.type === "markPrice") return latest.pricePerUnit ?? null;
  return latest.amount ? latest.costBasis / latest.amount : null;
}

// Cost basis vs current market value, one point per trailing month (default
// 12) - the series behind AccountDetailPage's growth chart. Unlike
// buildMonthlyNetWorth (account-LIST level, for the Home dashboard), this
// is scoped to one investment account and tracks the two figures
// getUnrealizedGainLoss already compares today, across time instead: cost
// basis only grows as Convert entries accumulate, current value moves
// independently with price. Both stay in the account's own cost currency,
// same "never PHP-translate an asset's own performance" rule as
// getAverageCost/getUnrealizedGainLoss. Returns [] for an account with no
// convert entries yet - nothing to chart.
export function buildInvestmentHistory(entries, accountId, monthsBack = 12, endDate = new Date()) {
  const converts = getConvertEntries(entries, accountId);
  if (converts.length === 0) return [];

  const rows = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const monthEndTs = toDayTimestamp(monthEnd);

    const costBasisToDate = converts
      .filter((e) => toDayTimestamp(e.date) <= monthEndTs)
      .reduce((sum, e) => sum + Number(e.costBasis || 0), 0);

    if (costBasisToDate === 0) continue; // nothing purchased yet as of this month - skip rather than plot a false zero

    rows.push({
      date: monthDate,
      costBasis: costBasisToDate,
      currentValue: getValueInCostCurrency(entries, accountId, monthEnd),
    });
  }
  return rows;
}

// The dollar-cost average itself, in the account's own cost currency -
// deliberately NOT converted to PHP (see foreign-assets-plan.md §1/§3 on
// why blending currency movement into an asset's own cost would
// misrepresent both). sum(costBasis across convert entries) / sum(their
// units). Returns null if the account has no convert entries yet.
export function getAverageCost(entries, accountId) {
  const converts = getConvertEntries(entries, accountId);
  const totalUnits = converts.reduce((s, e) => s + Number(e.amount || 0), 0);
  if (!totalUnits) return null;
  const totalCost = converts.reduce((s, e) => s + Number(e.costBasis || 0), 0);
  return totalCost / totalUnits;
}

// units held x latest price, in the account's own cost currency. Null
// propagates rather than defaulting to 0 - "unknown" and "worthless" are
// different things.
export function getValueInCostCurrency(entries, accountId, asOfDate = new Date()) {
  const units = getCurrentBalance(entries, accountId, asOfDate);
  if (units == null) return null;
  const price = getLatestPrice(entries, accountId, asOfDate);
  if (price == null) return null;
  return units * price;
}

// The chained PHP-equivalent value of ANY account, at ANY depth:
// - unit == null                    -> already PHP, return raw balance.
// - costCurrencyAccountId == null   -> one hop, priced directly in PHP.
// - costCurrencyAccountId set       -> recurse into the referenced
//   account to find "PHP per unit of its currency" (its own PHP value
//   divided by its own units held), then multiply through. This is what
//   makes a stock priced in USD, priced in turn against PHP, resolve
//   correctly without hardcoding two hops specifically - a third hop
//   would work the same way, though nothing in this app needs one yet.
// `_visited` is an internal cycle guard - creation-time validation should
// already prevent a cycle from ever being stored, but this never trusts
// stored data blindly rather than risking infinite recursion.
export function getCurrentValuePhp(entries, accounts, accountId, asOfDate = new Date(), _visited = new Set()) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account || account.unit == null) {
    return getCurrentBalance(entries, accountId, asOfDate);
  }

  if (_visited.has(accountId)) return null; // cycle guard
  const visited = new Set(_visited);
  visited.add(accountId);

  const valueInCostCurrency = getValueInCostCurrency(entries, accountId, asOfDate);
  if (valueInCostCurrency == null) return null;

  if (account.costCurrencyAccountId == null) return valueInCostCurrency; // already PHP

  const refAccount = accounts.find((a) => a.id === account.costCurrencyAccountId);
  if (!refAccount) return null;

  const refUnits = getCurrentBalance(entries, refAccount.id, asOfDate);
  if (!refUnits) return null;

  const refValuePhp = getCurrentValuePhp(entries, accounts, refAccount.id, asOfDate, visited);
  if (refValuePhp == null) return null;

  const rate = refValuePhp / refUnits; // PHP per unit of the referenced account's currency
  return valueInCostCurrency * rate;
}

// Gain/loss in the account's own cost currency (never PHP-translated - see
// getAverageCost). Returns null until both a convert entry and a price
// exist. `pct` is null rather than a divide-by-zero if cost basis is 0.
export function getUnrealizedGainLoss(entries, accountId) {
  const units = getCurrentBalance(entries, accountId);
  const avgCost = getAverageCost(entries, accountId);
  const currentValue = getValueInCostCurrency(entries, accountId);

  if (units == null || avgCost == null || currentValue == null) return null;

  const totalCostBasis = avgCost * units;
  const gainLoss = currentValue - totalCostBasis;
  const pct = totalCostBasis ? (gainLoss / Math.abs(totalCostBasis)) * 100 : null;

  return { gainLoss, pct, currentValue, totalCostBasis };
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
// inflow (income, convert, transfer, linked transactions) accounts for
// (untracked spend); < 0 means it gained more (missed income log,
// interest, etc.) - see accounts-feature-plan-v2.md §1.3/§3. Transfers
// between your own accounts, and transactions explicitly linked via "Paid
// From", are already folded into `incomeInPeriod` via getInflowEntries, so
// neither ever shows up here as unexplained/mystery movement.
export function getImpliedSpendPeriods(entries, accountId) {
  const reconciliations = getReconciliations(entries, accountId);
  const periods = [];

  for (let i = 0; i < reconciliations.length - 1; i++) {
    const from = reconciliations[i];
    const to = reconciliations[i + 1];
    const incomeInPeriod = sumInflowSinceAnchor(entries, accountId, from, to.date);
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

// ----------------------------------------------------------------------
// Liabilities (credit cards, etc - see liability-plan.md). A liability is
// just an `accounts` row with isLiability true and a balance that's
// expected to sit at or below zero (0 = paid off, more negative = owe
// more) - every function above this line already works correctly for one
// unmodified, since a linked purchase already subtracts via
// syncShadowExpenseEntry, a Transfer-in payment already adds via
// addTransfer, and getTotalBalance already nets it into net worth. Only
// statement-cycle bookkeeping is genuinely new.
// ----------------------------------------------------------------------

// Statement-close entries mark where one billing cycle ends and the next
// begins - a pure date marker, no amount. Logged explicitly by the user
// each cycle (see ExpenseContext's addStatementClose) rather than
// computed, since real-world cutoff dates shift by a day or more around
// weekends/holidays in ways that vary by card issuer. Mirrors
// getReconciliations exactly.
export function getStatementCloseEntries(entries, accountId) {
  return getAccountEntriesSorted(entries, accountId).filter((e) => e.type === "statementClose");
}

// Advisory only - a starting-point suggestion for the date field when
// logging a new statement close (LogStatementCloseModal), never trusted
// as the authoritative cutoff itself (that's whatever date the user
// actually confirms - see getStatementCloseEntries). Just "this month's
// expected cutoff day", clamped to the last day of short months.
export function suggestNextCutoffDate(cutoffDay, today = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(cutoffDay, daysInMonth);
  return new Date(today.getFullYear(), today.getMonth(), clampedDay);
}

// Whether the statement that closed on `cutoffDate` has been fully paid
// off - derived, never stored - plus `remainingDue`, a single signed
// figure: positive = still owed, 0 = settled exactly, negative = a credit
// (overpaid relative to what THIS statement billed - whether that credit
// already existed at cutoff time or came from payments since exceeding
// what was owed). New charges after the cutoff belong to the NEXT
// statement and never affect this one either way - paying off exactly
// what was billed reads remainingDue: 0 even if you've since spent again.
export function getStatementPaymentStatus(entries, accountId, cutoffDate) {
  const balanceAtCutoff = getBalanceAsOf(entries, accountId, cutoffDate);
  if (balanceAtCutoff == null) return null;

  const amountOwed = Math.max(-balanceAtCutoff, 0);
  const cutoffTs = toDayTimestamp(cutoffDate);

  const paidSinceCutoff = getInflowEntries(entries, accountId)
    .filter((e) => toDayTimestamp(e.date) > cutoffTs && Number(e.amount || 0) > 0)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const remainingDue = -balanceAtCutoff - paidSinceCutoff;

  return { isPaid: remainingDue <= 0, amountOwed, paidSinceCutoff, remainingDue };
}

// Bundles everything LiabilityDetailPage needs into one call: Total
// Balance (today, unbilled charges included), the most recently CLOSED
// statement's balance/due-date/paid-status, and available credit. Returns
// null statement fields rather than fabricating a cutoff when nothing's
// been logged yet - "Not reconciled yet"'s sibling for statements.
//
// Nothing here prevents (or should prevent) overpayment - totalBalance can
// go positive (0 = paid off, positive = the issuer owes YOU a credit
// balance). availableCredit reflects that directly rather than clamping it
// away: creditLimit + totalBalance is correct either way, since
// totalBalance is already signed - owing 5000 against a 10000 limit gives
// 5000 available; a 2000 overpayment gives 12000 available (full limit
// plus the credit sitting there).
export function getStatementInfo(entries, account, asOfDate = new Date()) {
  const totalBalance = getCurrentBalance(entries, account.id, asOfDate);

  const availableCredit =
    account.creditLimit != null && totalBalance != null ? account.creditLimit + totalBalance : null;

  const pastCloses = getStatementCloseEntries(entries, account.id).filter(
    (e) => toDayTimestamp(e.date) <= toDayTimestamp(asOfDate)
  );
  const lastClose = pastCloses.length > 0 ? pastCloses[pastCloses.length - 1] : null;

  if (!lastClose) {
    return {
      totalBalance,
      availableCredit,
      cutoffDate: null,
      statementBalance: null,
      dueDate: null,
      isPaid: null,
      remainingDue: null,
    };
  }

  const statementBalance = getBalanceAsOf(entries, account.id, lastClose.date);
  const dueDate = new Date(lastClose.date);
  dueDate.setDate(dueDate.getDate() + (account.dueDateOffsetDays || 0));

  const paymentStatus = getStatementPaymentStatus(entries, account.id, lastClose.date);

  return {
    totalBalance,
    availableCredit,
    cutoffDate: lastClose.date,
    statementBalance,
    dueDate,
    isPaid: paymentStatus?.isPaid ?? null,
    remainingDue: paymentStatus?.remainingDue ?? null,
  };
}
