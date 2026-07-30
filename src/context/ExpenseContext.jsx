// src/context/ExpenseContext.jsx
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { db } from "./db";
import { normalizeTravelId } from "../utils/travelHelpers";
import { validateImportShape } from "../utils/importValidation";
import {
  findDuplicateGroups,
  buildDayLookup,
  transactionFingerprint,
  yearFingerprint,
  monthFingerprint,
  dayFingerprint,
  bucketFingerprint,
  bucketAssignmentFingerprint,
  accountFingerprint,
  accountTypeFingerprint,
  balanceEntryFingerprint,
} from "../utils/importDedup";
import { isOldestReconciliation, getCurrentBalance, getCurrentValuePhp } from "../utils/balanceHelpers";
import { ALL_MONTHS } from "../utils/dateHelpers";

const ExpenseContext = createContext();

// Wraps a mutating DB operation so every write path logs and rethrows
// consistently, instead of some methods having try/catch and others not.
// UI callers (modals) still catch the rethrown error themselves to show
// an alert/toast - this just guarantees a useful console trace either way.
const withErrorHandling = (label, fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    console.error(`[ExpenseContext] ${label} failed:`, err);
    throw err;
  }
};

// Flattens the Year -> Month -> Day -> Transaction hierarchy into a single
// list. This walk was previously reimplemented independently in
// SummaryPage, TravelsPage, and TravelDetailPage - now computed once here
// and exposed as `allTransactions`.
const flattenTransactions = (years) =>
  years
    .flatMap((y) => y.months ?? [])
    .flatMap((m) => m.days ?? [])
    .flatMap((d) => d.transactions ?? []);

export function ExpenseProvider({ children }) {
  const [years, setYears] = useState([]);
  const [travels, setTravels] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [balanceEntries, setBalanceEntries] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);

  // ---------------------------
  // Load full hierarchy from DB
  // ---------------------------
  const reloadHierarchy = async () => {
    const allYears = await db.years.toArray();
    const allMonths = await db.months.toArray();
    const allDays = await db.days.toArray();
    const allTransactionsRaw = await db.transactions.toArray();
    const allTravels = await db.travels.toArray();

    const travelMap = Object.fromEntries(allTravels.map((t) => [t.id, t]));

    const structured = allYears.map((y) => ({
      ...y,
      months: allMonths
        .filter((m) => m.yearId === y.id)
        .map((m) => ({
          ...m,
          days: allDays
            .filter((d) => d.monthId === m.id && d.yearId === y.id)
            .map((d) => ({
              ...d,
              transactions: allTransactionsRaw
                .filter(
                  (t) =>
                    t.dayId === d.id &&
                    t.monthId === m.id &&
                    t.yearId === y.id
                )
                .map((t) => ({
                  ...t,
                  travel: t.travelId ? travelMap[t.travelId] || null : null,
                  // Denormalized display fields - avoids every consumer
                  // re-deriving these via nested year/month .find() lookups.
                  dayNumber: d.day,
                  monthName: m.name,
                  yearNumber: y.year,
                })),
            })),
        })),
    }));

    setYears(structured);
    setTravels(allTravels);
  };

  useEffect(() => {
    reloadHierarchy();
  }, []);

  // ---------------------------
  // Load Assets (accounts + balanceEntries) - kept as its own reload,
  // separate from reloadHierarchy, since Assets are deliberately
  // independent of the expense hierarchy (see accounts-feature-plan-v2.md
  // §0/§2 - no accountId on transactions, no shared filter state).
  // ---------------------------
  const reloadAssets = async () => {
    const [allAccounts, allBalanceEntries, allAccountTypes] = await Promise.all([
      db.accounts.toArray(),
      db.balanceEntries.toArray(),
      db.accountTypes.toArray(),
    ]);
    setAccounts(allAccounts);
    setBalanceEntries(allBalanceEntries);
    setAccountTypes(allAccountTypes);
  };

  useEffect(() => {
    reloadAssets();
  }, []);

  // Single computed flat list of every transaction, derived from `years`.
  // Exposed so pages don't each re-flatten the hierarchy themselves.
  const allTransactions = useMemo(() => flattenTransactions(years), [years]);

  // ---------------------------
  // Year operations
  // ---------------------------
  const addYear = withErrorHandling("addYear", async (yearNumber) => {
    const existing = await db.years.where({ year: yearNumber }).first();
    if (existing) return existing.id;

    const yearId = await db.years.add({ year: yearNumber });
    await reloadHierarchy();
    return yearId;
  });

  const removeYear = withErrorHandling("removeYear", async (yearId) => {
    const monthsToDelete = await db.months.where({ yearId }).toArray();
    for (const m of monthsToDelete) await removeMonth(m.id);
    await db.years.delete(yearId);
    await reloadHierarchy();
  });

  // ---------------------------
  // Month operations
  // ---------------------------
  const addMonth = withErrorHandling("addMonth", async (yearId, name) => {
    const existing = await db.months
      .where("[yearId+name]")
      .equals([yearId, name])
      .first();
    if (existing) return existing.id;

    const monthId = await db.months.add({ yearId, name });
    await reloadHierarchy();
    return monthId;
  });

  const removeMonth = withErrorHandling("removeMonth", async (monthId) => {
    const daysToDelete = await db.days.where({ monthId }).toArray();
    for (const d of daysToDelete) await removeDay(d.id);
    await db.months.delete(monthId);
    await reloadHierarchy();
  });

  // ---------------------------
  // Day operations
  // ---------------------------
  const addDay = withErrorHandling("addDay", async (yearId, monthId, dayNumber) => {
    const existing = await db.days
      .where("[yearId+monthId+day]")
      .equals([yearId, monthId, dayNumber])
      .first();
    if (existing) return existing.id;

    const dayId = await db.days.add({ yearId, monthId, day: dayNumber });
    await reloadHierarchy();
    return dayId;
  });

  const removeDay = withErrorHandling("removeDay", async (dayId) => {
    const transactionsToDelete = await db.transactions.where({ dayId }).toArray();
    await db.transactions.where({ dayId }).delete();
    for (const t of transactionsToDelete) {
      await syncShadowExpenseEntry(t.id); // rows are already gone - this just cleans up any shadow
    }
    await db.days.delete(dayId);
    await reloadHierarchy();
    await reloadAssets();
  });

  // Resolves the real calendar Date for a transaction's (yearId, monthId,
  // dayId). Transactions themselves only store those three ids - the
  // enriched dayNumber/monthName/yearNumber fields every page reads are
  // computed in reloadHierarchy(), which a mid-write helper can't rely on
  // being fresh. Returns null if any of the three rows is missing (never
  // trusts stored ids blindly).
  const resolveTransactionDate = async (yearId, monthId, dayId) => {
    const [year, month, day] = await Promise.all([
      db.years.get(yearId),
      db.months.get(monthId),
      db.days.get(dayId),
    ]);
    if (!year || !month || !day) return null;
    return new Date(year.year, ALL_MONTHS.indexOf(month.name), day.day);
  };

  // Keeps a transaction's shadow "expense" balanceEntries row in sync with
  // whatever the transaction currently looks like (see db.js v8 / Balance
  // Transfers' addTransfer for the same paired-entry pattern). Always
  // fully regenerated - delete then recreate - rather than patched
  // incrementally, so the two can never quietly drift apart. A no-op if
  // there was no shadow and the transaction isn't linked either way.
  // Called after every add/update/delete on a transaction.
  const syncShadowExpenseEntry = async (transactionId) => {
    const existingShadow = await db.balanceEntries
      .filter((e) => e.type === "expense" && e.sourceTransactionId === transactionId)
      .first();
    if (existingShadow) await db.balanceEntries.delete(existingShadow.id);

    const transaction = await db.transactions.get(transactionId);
    if (!transaction || transaction.accountId == null) return; // deleted, or not linked - nothing to shadow

    const date = await resolveTransactionDate(transaction.yearId, transaction.monthId, transaction.dayId);
    if (!date) return; // orphaned year/month/day - shouldn't happen, but never assumed

    await db.balanceEntries.add({
      accountId: transaction.accountId,
      date,
      type: "expense",
      amount: -Number(transaction.amount || 0),
      balance: null,
      costBasis: null,
      fee: null,
      pricePerUnit: null,
      category: transaction.category || null,
      comments: transaction.comments || "",
      sourceTransactionId: transactionId,
    });
  };

  // ---------------------------
  // Transaction operations
  // ---------------------------
  const addTransaction = withErrorHandling(
    "addTransaction",
    async (yearId, monthId, dayId, transaction) => {
      const existing = await db.transactions
        .where("[yearId+monthId+dayId+category]")
        .equals([yearId, monthId, dayId, transaction.category])
        .first();

      if (existing) return existing.id;

      const id = await db.transactions.add({
        ...transaction,
        yearId,
        monthId,
        dayId,
        travelId: normalizeTravelId(transaction.travelId),
        accountId: transaction.accountId ?? null,
      });

      await syncShadowExpenseEntry(id);
      await reloadHierarchy();
      await reloadAssets();
      return id;
    }
  );

  const updateTransaction = withErrorHandling(
    "updateTransaction",
    async (transactionId, updatedFields) => {
      const normalizedFields =
        "travelId" in updatedFields
          ? { ...updatedFields, travelId: normalizeTravelId(updatedFields.travelId) }
          : updatedFields;
      await db.transactions.update(transactionId, normalizedFields);
      await syncShadowExpenseEntry(transactionId);
      await reloadHierarchy();
      await reloadAssets();
    }
  );

  const removeTransaction = withErrorHandling("removeTransaction", async (transactionId) => {
    await db.transactions.delete(transactionId);
    await syncShadowExpenseEntry(transactionId); // transaction's gone - this just cleans up any shadow it had
    await reloadHierarchy();
    await reloadAssets();
  });

  // ---------------------------
  // Travel operations
  // ---------------------------
  const addTravel = withErrorHandling(
    "addTravel",
    async ({ title, startDate, endDate, comments }) => {
      const id = await db.travels.add({
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        comments,
      });

      await reloadHierarchy();
      return id;
    }
  );

  const updateTravel = withErrorHandling("updateTravel", async (travelId, updates) => {
    await db.travels.update(travelId, {
      ...updates,
      startDate: updates.startDate ? new Date(updates.startDate) : undefined,
      endDate: updates.endDate ? new Date(updates.endDate) : undefined,
    });

    await reloadHierarchy();
  });

  const removeTravel = withErrorHandling("removeTravel", async (travelId) => {
    const normalizedId = normalizeTravelId(travelId);

    // Unlink transactions instead of deleting them - their spend history
    // should survive the travel tag being removed.
    await db.transactions.where({ travelId: normalizedId }).modify({ travelId: null });

    await db.travels.delete(normalizedId);
    await reloadHierarchy();
  });

  const getTravelTransactions = withErrorHandling(
    "getTravelTransactions",
    async (travelId) => {
      const normalizedId = normalizeTravelId(travelId);
      return await db.transactions.where({ travelId: normalizedId }).toArray();
    }
  );

  // ---------------------------
  // Account operations (Assets feature)
  //
  // Transactions can now optionally be "Paid From" an account (see db.js
  // v8 / linked-transactions-plan.md) - accounts and the expense hierarchy
  // are no longer fully independent the way accounts-feature-plan-v2
  // originally described. Linking is per-transaction and always optional;
  // most transactions are still expected to stay unlinked.
  // ---------------------------
  const addAccount = withErrorHandling(
    "addAccount",
    async ({
      name,
      startingBalance,
      startingDate,
      typeId = null,
      unit = null,
      costCurrencyAccountId = null,
      startingCostBasis = null, // only meaningful when unit is set - see below
      startingPrice = null, // only meaningful when unit is set; the UI requires this for foreign accounts
      isLiability = false,
      creditLimit = null, // liability-only; plain mutable field, not historically tracked
      statementCutoffDay = null, // liability-only; advisory prefill for logging statement closes, see suggestNextCutoffDate
      dueDateOffsetDays = null, // liability-only; due date = logged cutoff date + this many days
    }) => {
      const accountId = await db.accounts.add({
        name: name.trim(),
        typeId: typeId ?? null,
        unit: unit || null,
        costCurrencyAccountId: unit ? costCurrencyAccountId ?? null : null,
        isLiability: Boolean(isLiability),
        creditLimit: isLiability && creditLimit != null && creditLimit !== "" ? Number(creditLimit) : null,
        statementCutoffDay: isLiability ? Number(statementCutoffDay) : null,
        dueDateOffsetDays: isLiability ? Number(dueDateOffsetDays) : null,
        createdAt: new Date(),
      });

      const hasKnownCostBasis =
        Boolean(unit) && startingCostBasis != null && startingCostBasis !== "";

      // The anchor: if we also know what the starting units cost, the
      // anchor is "0 held" and a separate convert entry brings it up to
      // the starting balance while recording that cost (reconciliation
      // entries have no costBasis field - only convert entries do, see
      // foreign-assets-plan.md §2.2). Otherwise (PHP accounts, or foreign
      // accounts where cost basis isn't known), the starting balance IS
      // the reconciliation itself, same as before - there's no separate
      // openingBalance field.
      await db.balanceEntries.add({
        accountId,
        date: new Date(startingDate),
        type: "reconciliation",
        amount: null,
        balance: hasKnownCostBasis ? 0 : Number(startingBalance) || 0,
        costBasis: null,
        fee: null,
        pricePerUnit: null,
        category: null,
        comments: "Starting balance",
      });

      if (hasKnownCostBasis) {
        await db.balanceEntries.add({
          accountId,
          date: new Date(startingDate),
          type: "convert",
          amount: Number(startingBalance) || 0,
          balance: null,
          costBasis: Number(startingCostBasis),
          fee: null,
          pricePerUnit: null,
          category: null,
          comments: "Starting units",
        });
      }

      // Foreign accounts need a price before anything downstream can show
      // a value at all - the UI requires this field, but it's guarded
      // here too rather than trusted blindly.
      if (unit && startingPrice != null && startingPrice !== "") {
        await db.balanceEntries.add({
          accountId,
          date: new Date(startingDate),
          type: "markPrice",
          amount: null,
          balance: null,
          costBasis: null,
          fee: null,
          pricePerUnit: Number(startingPrice),
          category: null,
          comments: "Starting price",
        });
      }

      await reloadAssets();
      return accountId;
    }
  );

  const updateAccount = withErrorHandling("updateAccount", async (accountId, fields) => {
    await db.accounts.update(accountId, fields);
    await reloadAssets();
  });

  const removeAccount = withErrorHandling("removeAccount", async (accountId) => {
    // Cascade-delete balanceEntries, unlike Travel removal (which unlinks).
    // An income/reconciliation entry - or a shadow "expense" entry for a
    // transaction that was linked here - orphaned from its account isn't
    // meaningful on its own the way a transaction is meaningful without an
    // account tag - see plan §6. The real transactions survive, unlinked.
    await db.balanceEntries.where({ accountId }).delete();
    await db.transactions.where({ accountId }).modify({ accountId: null });
    await db.accounts.delete(accountId);
    await reloadAssets();
    await reloadHierarchy(); // transactions changed too (unlinked), not just assets
  });

  const addIncomeEntry = withErrorHandling(
    "addIncomeEntry",
    async (accountId, { date, amount, category, comments }) => {
      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "income",
        amount: Number(amount),
        balance: null,
        category: category?.trim() || null,
        comments: comments?.trim() || "",
      });
      await reloadAssets();
      return id;
    }
  );

  // Stores the *observed* balance itself (a snapshot), not a computed
  // delta - this is what makes backfilling an earlier reconciliation safe.
  // The UI computes and displays the implied delta live (plan §3), but
  // nothing derived is ever what gets written here.
  const addReconciliation = withErrorHandling(
    "addReconciliation",
    async (accountId, { date, balance, comments }) => {
      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "reconciliation",
        amount: null,
        balance: Number(balance),
        category: null,
        comments: comments?.trim() || "",
      });
      await reloadAssets();
      return id;
    }
  );

  // Marks where one liability billing cycle ends and the next begins - a
  // pure date marker, no amount. Logged explicitly by the user each cycle
  // (via LogStatementCloseModal) rather than computed, since real-world
  // cutoff dates shift by a day or more around weekends/holidays in ways
  // that vary by issuer - see getStatementCloseEntries/suggestNextCutoffDate
  // in balanceHelpers.js. Mirrors addReconciliation's shape closely.
  const addStatementClose = withErrorHandling(
    "addStatementClose",
    async (accountId, { date, comments }) => {
      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "statementClose",
        amount: null,
        balance: null,
        costBasis: null,
        fee: null,
        pricePerUnit: null,
        category: null,
        comments: comments?.trim() || "",
      });
      await reloadAssets();
      return id;
    }
  );

  // Convert: PHP (or another tracked currency, chained via
  // costCurrencyAccountId) becomes units of this account - the "Buy"/
  // "Convert" action for accounts with a `unit` set. Distinct from
  // addIncomeEntry, which stays PHP-accounts-only and untouched (see
  // foreign-assets-plan.md §0/§2.2 - a conversion is not income).
  const addConvertEntry = withErrorHandling(
    "addConvertEntry",
    async (accountId, { date, amount, costBasis, fee = null, feeCategory = null, comments }) => {
      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "convert",
        amount: Number(amount),
        balance: null,
        costBasis: Number(costBasis),
        fee: fee != null && fee !== "" ? Number(fee) : null,
        pricePerUnit: null,
        category: null,
        comments: comments?.trim() || "",
      });

      // Fee auto-logging - the one deliberate exception to accounts and
      // expenses staying independent (foreign-assets-plan.md §5), scoped
      // narrowly to conversion fees. Skipped entirely if no fee was given,
      // so this changes nothing for a plain conversion.
      //
      // Known limitation: the resulting transaction is only linked back to
      // this convert entry via its `comments` text, not a real reference -
      // deleting the convert entry later does not delete or adjust the fee
      // transaction. Acceptable for v1; would need a proper FK to do more.
      if (fee != null && fee !== "" && Number(fee) > 0) {
        const [allAccounts, allEntries] = await Promise.all([
          db.accounts.toArray(),
          db.balanceEntries.toArray(),
        ]);
        const account = allAccounts.find((a) => a.id === accountId);

        let feeInPhp = Number(fee);
        let feeNote = "";

        if (account?.costCurrencyAccountId != null) {
          // Fee is in a foreign currency - convert to PHP via the same
          // chained lookup used everywhere else, at the conversion date.
          const refUnits = getCurrentBalance(allEntries, account.costCurrencyAccountId, new Date(date));
          const refValuePhp = getCurrentValuePhp(
            allEntries,
            allAccounts,
            account.costCurrencyAccountId,
            new Date(date)
          );
          if (refUnits && refValuePhp != null) {
            const rate = refValuePhp / refUnits;
            feeInPhp = Number(fee) * rate;
            feeNote = ` ($${Number(fee).toFixed(2)} \u2248 \u20b1${feeInPhp.toFixed(2)})`;
          }
        }

        const feeDate = new Date(date);
        const category = feeCategory?.trim() || "Fees";

        const yearId = await addYear(feeDate.getFullYear());
        const monthId = await addMonth(yearId, ALL_MONTHS[feeDate.getMonth()]);
        const dayId = await addDay(yearId, monthId, feeDate.getDate());

        // The transactions table enforces one row per (day, category) -
        // merge into an existing same-day/same-category row (via the
        // amount-breakdown feature) rather than risking addTransaction's
        // own idempotent existence-check silently dropping a second fee.
        const existingFeeTx = await db.transactions
          .where("[yearId+monthId+dayId+category]")
          .equals([yearId, monthId, dayId, category])
          .first();

        if (existingFeeTx) {
          const newBreakdown = [...(existingFeeTx.amountBreakdown || [existingFeeTx.amount]), feeInPhp];
          await db.transactions.update(existingFeeTx.id, {
            amount: newBreakdown.reduce((s, v) => s + Number(v), 0),
            amountBreakdown: newBreakdown,
            comments: existingFeeTx.comments
              ? `${existingFeeTx.comments}; auto-logged fee${feeNote}`
              : `Auto-logged: ${account?.name || "account"} conversion fee${feeNote}`,
          });
        } else {
          await db.transactions.add({
            yearId,
            monthId,
            dayId,
            category,
            amount: feeInPhp,
            amountBreakdown: [feeInPhp],
            comments: `Auto-logged: ${account?.name || "account"} conversion fee${feeNote}`,
            travelId: null,
          });
        }

        await reloadHierarchy();
      }

      await reloadAssets();
      return id;
    }
  );

  // A pure valuation snapshot - "1 unit = X cost-currency, as of today."
  // Doesn't touch units held, the same way a reconciliation doesn't touch
  // cost basis (foreign-assets-plan.md §2.2).
  const addMarkPrice = withErrorHandling(
    "addMarkPrice",
    async (accountId, { date, pricePerUnit, comments }) => {
      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "markPrice",
        amount: null,
        balance: null,
        costBasis: null,
        fee: null,
        pricePerUnit: Number(pricePerUnit),
        category: null,
        comments: comments?.trim() || "",
      });
      await reloadAssets();
      return id;
    }
  );

  // Transfer: moves units between two of the user's own accounts. Unlike
  // Convert, this never changes what the units *are* - both legs must
  // share the same `unit` (null == null counts, i.e. two ordinary PHP
  // accounts). Crossing currencies is a Transfer-then-Convert flow
  // instead: move PHP in via a same-unit transfer, then Convert it, which
  // already handles cost basis and fees correctly - see
  // balance-transfers-plan.md.
  //
  // Written as two balanceEntries rows (type "transfer") linked by a
  // generated transferGroupId: a negative-amount leg on the source
  // account, a positive-amount leg on the destination. Deliberately NOT
  // logged as "income" on the destination or implied-spend on the source -
  // getInflowEntries in balanceHelpers.js folds both legs into the normal
  // balance walk so neither side is misreported.
  const addTransfer = withErrorHandling(
    "addTransfer",
    async (fromAccountId, toAccountId, { date, amount, comments }) => {
      if (fromAccountId === toAccountId) {
        throw new Error("Can't transfer an account to itself.");
      }

      const allAccounts = await db.accounts.toArray();
      const fromAccount = allAccounts.find((a) => a.id === fromAccountId);
      const toAccount = allAccounts.find((a) => a.id === toAccountId);
      if (!fromAccount || !toAccount) throw new Error("Account not found.");

      if ((fromAccount.unit || null) !== (toAccount.unit || null)) {
        throw new Error(
          "Transfers must be between accounts of the same currency/unit - use Convert first if you need to change currencies."
        );
      }

      const transferGroupId = `xfer_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const amt = Number(amount);
      const trimmedComments = comments?.trim() || "";
      const entryDate = new Date(date);

      const outId = await db.balanceEntries.add({
        accountId: fromAccountId,
        date: entryDate,
        type: "transfer",
        amount: -amt,
        balance: null,
        costBasis: null,
        fee: null,
        pricePerUnit: null,
        category: null,
        comments: trimmedComments,
        transferGroupId,
        counterpartAccountId: toAccountId,
      });

      const inId = await db.balanceEntries.add({
        accountId: toAccountId,
        date: entryDate,
        type: "transfer",
        amount: amt,
        balance: null,
        costBasis: null,
        fee: null,
        pricePerUnit: null,
        category: null,
        comments: trimmedComments,
        transferGroupId,
        counterpartAccountId: fromAccountId,
      });

      await reloadAssets();
      return { transferGroupId, outId, inId };
    }
  );

  const removeBalanceEntry = withErrorHandling("removeBalanceEntry", async (entryId) => {
    // Fetch fresh from DB rather than trusting the balanceEntries closure -
    // same caution as cleanBucketAssignments below.
    const allEntries = await db.balanceEntries.toArray();
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) return;

    if (entry.type === "reconciliation" && isOldestReconciliation(allEntries, entry.accountId, entryId)) {
      throw new Error(
        "Can't delete an account's earliest reconciliation - it anchors the whole balance history. Delete the account itself if you want to remove it entirely."
      );
    }

    // A transfer only makes sense as a pair - deleting one leg without the
    // other would leave the money "created" or "destroyed" on whichever
    // side survives. Always remove both legs together via transferGroupId.
    if (entry.type === "transfer" && entry.transferGroupId) {
      const pairIds = allEntries
        .filter((e) => e.transferGroupId === entry.transferGroupId)
        .map((e) => e.id);
      await db.balanceEntries.bulkDelete(pairIds);
      await reloadAssets();
      return;
    }

    await db.balanceEntries.delete(entryId);
    await reloadAssets();
  });

  // Derived list of distinct income categories, for the Add Income
  // autocomplete - same pattern as `categories` below for expenses.
  const incomeCategories = useMemo(() => {
    const cats = new Set(
      balanceEntries
        .filter((e) => e.type === "income")
        .map((e) => e.category)
        .filter(Boolean)
    );
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [balanceEntries]);

  // ---------------------------
  // Account Type operations (classifications like Bank Account, Digital
  // Bank, Investment, Time Deposit, etc.) - user-adjustable, same "zero or
  // one at a time" relationship categories have with buckets. Unlike
  // categories, accounts already have a real numeric id, so `typeId` lives
  // directly on the account row rather than needing a join table.
  //
  // Names are unique (case-insensitive, trimmed) - fetched fresh from DB
  // rather than trusting the accountTypes closure, same caution as
  // cleanBucketAssignments and removeBalanceEntry above.
  // ---------------------------
  const addAccountType = withErrorHandling("addAccountType", async (name) => {
    const trimmed = name.trim();
    const existingTypes = await db.accountTypes.toArray();
    const existing = existingTypes.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());

    // Idempotent, like addYear/addMonth/addDay: creating a type that
    // already exists (by name) just hands back the existing one rather
    // than creating a true duplicate row.
    if (existing) return existing.id;

    const id = await db.accountTypes.add({ name: trimmed });
    await reloadAssets();
    return id;
  });

  const updateAccountType = withErrorHandling("updateAccountType", async (typeId, fields) => {
    if ("name" in fields) {
      const trimmed = fields.name.trim();
      const existingTypes = await db.accountTypes.toArray();
      const collision = existingTypes.find(
        (t) => t.id !== typeId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
      );

      // Unlike creation, a rename that collides is more likely a genuine
      // mistake than an intentional "reuse this one" - surfaced as an
      // error instead of silently merging.
      if (collision) {
        throw new Error(`A type named "${collision.name}" already exists.`);
      }

      fields = { ...fields, name: trimmed };
    }

    await db.accountTypes.update(typeId, fields);
    await reloadAssets();
  });

  const removeAccountType = withErrorHandling("removeAccountType", async (typeId) => {
    // Accounts assigned to this type fall back to unclassified, mirroring
    // how removing a bucket makes its categories "Unassigned" rather than
    // deleting anything downstream.
    const affected = await db.accounts.where({ typeId }).toArray();
    for (const a of affected) {
      await db.accounts.update(a.id, { typeId: null });
    }
    await db.accountTypes.delete(typeId);
    await reloadAssets();
  });

  // ---------------------------
  // Helpers
  // ---------------------------
  const getYearId = async (yearNumber) => {
    const existing = await db.years.where({ year: yearNumber }).first();
    return existing ? existing.id : null;
  };

  const getMonthId = async (yearId, monthName) => {
    const existing = await db.months
      .where("[yearId+name]")
      .equals([yearId, monthName])
      .first();
    return existing ? existing.id : null;
  };

  const clearDB = withErrorHandling("clearDB", async () => {
    await db.transactions.clear();
    await db.days.clear();
    await db.months.clear();
    await db.years.clear();
    await db.travels.clear();
    await db.buckets.clear();
    await db.bucketAssignments.clear();
    await db.accounts.clear();
    await db.balanceEntries.clear();
    await db.accountTypes.clear();
    setYears([]);
    setTravels([]);
    setAccounts([]);
    setBalanceEntries([]);
    setAccountTypes([]);
  });

  // -------------------------
  // Export Expenses
  // -------------------------
  const exportExpenses = withErrorHandling("exportExpenses", async () => {
    const exportData = {
      years: await db.years.toArray(),
      months: await db.months.toArray(),
      days: await db.days.toArray(),
      transactions: await db.transactions.toArray(),
      travels: await db.travels.toArray(),
      buckets: await db.buckets.toArray(),
      bucketAssignments: await db.bucketAssignments.toArray(),
      accounts: await db.accounts.toArray(),
      balanceEntries: await db.balanceEntries.toArray(),
      accountTypes: await db.accountTypes.toArray(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_export_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // -------------------------
  // Import Expenses - split into parse (no DB writes) and commit, so
  // callers can show a preview/confirmation before anything is written.
  // Previously this happened in one shot with zero warning to the user.
  // -------------------------
  const parseImportFile = withErrorHandling("parseImportFile", async (file) => {
    const text = await file.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }

    // Throws a descriptive error if the shape doesn't match what this app
    // can map - caught by the caller before anything is shown or written.
    const { years, months, days, transactions, travels, buckets, bucketAssignments, accounts, balanceEntries, accountTypes } =
      validateImportShape(parsed);

    const data = { years, months, days, transactions, travels, buckets, bucketAssignments, accounts, balanceEntries, accountTypes };
    const counts = {
      years: years.length,
      months: months.length,
      days: days.length,
      transactions: transactions.length,
      travels: travels.length,
      buckets: buckets.length,
      accounts: accounts.length,
      balanceEntries: balanceEntries.length,
      accountTypes: accountTypes.length,
    };

    return { data, counts };
  });

  // -------------------------
  // Import safeguard: after a commit, scan the *full* resulting tables
  // (existing + just-imported data together, since duplicates can span
  // both) for records that represent the same real-world thing under
  // different ids - e.g. merging exports from two devices whose
  // autoincrement counters diverged. Resolves deterministically by
  // keeping the highest-id record in each duplicate group.
  // -------------------------
  const cleanupDuplicatesAfterImport = async () => {
    const [allYears, allMonths, allDays, allTx, allBuckets, allAssignments, allAccounts, allBalanceEntries, allAccountTypes] =
      await Promise.all([
        db.years.toArray(),
        db.months.toArray(),
        db.days.toArray(),
        db.transactions.toArray(),
        db.buckets.toArray(),
        db.bucketAssignments.toArray(),
        db.accounts.toArray(),
        db.balanceEntries.toArray(),
        db.accountTypes.toArray(),
      ]);

    // =====================================================================
    // Years / Months / Days / Transactions
    //
    // Everything below happens in memory first and is written to the DB
    // exactly once at the end. This matters because `transactions` has a
    // compound unique index on [yearId+monthId+dayId+category] - remapping
    // FKs one write at a time risks a transient ConstraintError if two
    // surviving rows briefly collide on that key mid-remap.
    // =====================================================================

    // ---- Step 1: dedupe transactions by their original content fingerprint
    // (year/month/day/category/amount/comments/breakdown/travel), computed
    // against the *pre-remap* ids exactly as they came from the DB/import. ----
    const dayLookup = buildDayLookup(allYears, allMonths, allDays);
    const contentDupes = findDuplicateGroups(allTx, (t) => transactionFingerprint(t, dayLookup));
    const removedTxIdsByContent = contentDupes.flatMap(({ remove }) => remove.map((t) => t.id));
    const removedByContentSet = new Set(removedTxIdsByContent);
    let workingTx = allTx.filter((t) => !removedByContentSet.has(t.id));

    // ---- Step 2: dedupe years by year number -> yearIdRemap, applied
    // in-memory to the surviving months/days/transactions. ----
    const yearDupes = findDuplicateGroups(allYears, yearFingerprint);
    const yearIdRemap = {};
    const removedYearIds = [];
    for (const { keep, remove } of yearDupes) {
      for (const y of remove) {
        yearIdRemap[y.id] = keep.id;
        removedYearIds.push(y.id);
      }
    }
    const remapYear = (id) => (id in yearIdRemap ? yearIdRemap[id] : id);

    let workingMonths = allMonths.map((m) => ({ ...m, yearId: remapYear(m.yearId) }));
    let workingDays = allDays.map((d) => ({ ...d, yearId: remapYear(d.yearId) }));
    workingTx = workingTx.map((t) => ({ ...t, yearId: remapYear(t.yearId) }));

    // ---- Step 3: dedupe months by (yearId, name) *post year-remap* ->
    // monthIdRemap, applied in-memory to days/transactions. ----
    const monthDupes = findDuplicateGroups(workingMonths, monthFingerprint);
    const monthIdRemap = {};
    const removedMonthIds = [];
    for (const { keep, remove } of monthDupes) {
      for (const m of remove) {
        monthIdRemap[m.id] = keep.id;
        removedMonthIds.push(m.id);
      }
    }
    const remapMonth = (id) => (id in monthIdRemap ? monthIdRemap[id] : id);

    workingMonths = workingMonths.filter((m) => !monthIdRemap.hasOwnProperty(m.id));
    workingDays = workingDays.map((d) => ({ ...d, monthId: remapMonth(d.monthId) }));
    workingTx = workingTx.map((t) => ({ ...t, monthId: remapMonth(t.monthId) }));

    // ---- Step 4: dedupe days by (yearId, monthId, day) *post month-remap*
    // -> dayIdRemap, applied in-memory to transactions. ----
    const dayDupes = findDuplicateGroups(workingDays, dayFingerprint);
    const dayIdRemap = {};
    const removedDayIds = [];
    for (const { keep, remove } of dayDupes) {
      for (const d of remove) {
        dayIdRemap[d.id] = keep.id;
        removedDayIds.push(d.id);
      }
    }
    const remapDay = (id) => (id in dayIdRemap ? dayIdRemap[id] : id);

    workingDays = workingDays.filter((d) => !dayIdRemap.hasOwnProperty(d.id));
    workingTx = workingTx.map((t) => ({ ...t, dayId: remapDay(t.dayId) }));

    // ---- Step 5: critical safety pass - the remaps above can themselves
    // create brand-new (yearId+monthId+dayId+category) collisions between
    // two transactions whose *content* differed (so step 1 didn't catch
    // them) but which now land on the same day+category after merging.
    // Must run, and must be resolved, before any DB write - otherwise
    // `bulkPut` can throw a ConstraintError against the transactions
    // table's compound unique index. ----
    const collisionKey = (t) => `${t.yearId}:${t.monthId}:${t.dayId}:${t.category}`;
    const collisionDupes = findDuplicateGroups(workingTx, collisionKey);
    const removedTxIdsByCollision = collisionDupes.flatMap(({ remove }) => remove.map((t) => t.id));
    const removedByCollisionSet = new Set(removedTxIdsByCollision);
    workingTx = workingTx.filter((t) => !removedByCollisionSet.has(t.id));

    // ---- Step 6: write once. Deletes first (removed ids can never reappear
    // in the surviving arrays below, so ordering here is safe), then puts. ----
    const removedTxIds = [...removedTxIdsByContent, ...removedTxIdsByCollision];

    if (removedTxIds.length > 0) await db.transactions.bulkDelete(removedTxIds);
    if (removedDayIds.length > 0) await db.days.bulkDelete(removedDayIds);
    if (removedMonthIds.length > 0) await db.months.bulkDelete(removedMonthIds);
    if (removedYearIds.length > 0) await db.years.bulkDelete(removedYearIds);

    if (workingMonths.length > 0) await db.months.bulkPut(workingMonths);
    if (workingDays.length > 0) await db.days.bulkPut(workingDays);
    if (workingTx.length > 0) await db.transactions.bulkPut(workingTx);

    // If a transaction that was linked to an account gets removed as a
    // duplicate above, its shadow "expense" entry must go with it -
    // otherwise the surviving (kept) duplicate's own shadow entry would
    // double-count the same real-world expense against that account's
    // balance.
    if (removedTxIds.length > 0) {
      const orphanedShadows = allBalanceEntries.filter(
        (e) => e.type === "expense" && e.sourceTransactionId != null && removedTxIds.includes(e.sourceTransactionId)
      );
      if (orphanedShadows.length > 0) {
        await db.balanceEntries.bulkDelete(orphanedShadows.map((e) => e.id));
      }
    }

    // =====================================================================
    // Step 7: Buckets / bucket assignments - unchanged from before.
    // =====================================================================

    // Buckets duplicated by name - keep highest id, remap any assignments
    // pointing at the removed (lower-id, "older") duplicates over to the
    // retained bucket.
    const bucketDupes = findDuplicateGroups(allBuckets, bucketFingerprint);
    const bucketIdRemap = {};
    const removedBucketIds = [];
    for (const { keep, remove } of bucketDupes) {
      for (const b of remove) {
        bucketIdRemap[b.id] = keep.id;
        removedBucketIds.push(b.id);
      }
    }

    if (removedBucketIds.length > 0) {
      const toRemap = allAssignments.filter((a) => removedBucketIds.includes(a.bucketId));
      for (const a of toRemap) {
        await db.bucketAssignments.update(a.id, { bucketId: bucketIdRemap[a.bucketId] });
      }
      await db.buckets.bulkDelete(removedBucketIds);
    }

    // Bucket assignments duplicated by (bucket, category) - remapping above
    // can itself create fresh duplicates (two old buckets both had "Food"
    // assigned, both now point at the same retained bucket).
    const assignmentsAfterRemap = await db.bucketAssignments.toArray();
    const assignmentDupes = findDuplicateGroups(assignmentsAfterRemap, bucketAssignmentFingerprint);
    const removedAssignmentIds = assignmentDupes.flatMap(({ remove }) => remove.map((a) => a.id));
    if (removedAssignmentIds.length > 0) {
      await db.bucketAssignments.bulkDelete(removedAssignmentIds);
    }

    // =====================================================================
    // Step 8: Accounts / balance entries - same shape as buckets/
    // bucketAssignments above (name-based dedup, then remap, then a second
    // pass for duplicates the remap itself creates). Notably simpler than
    // the years/months/days work: balanceEntries has no compound unique
    // index, so there's no ConstraintError risk and no need for an
    // in-memory-first/single-write choreography.
    // =====================================================================
    const accountDupes = findDuplicateGroups(allAccounts, accountFingerprint);
    const accountIdRemap = {};
    const removedAccountIds = [];
    for (const { keep, remove } of accountDupes) {
      for (const a of remove) {
        accountIdRemap[a.id] = keep.id;
        removedAccountIds.push(a.id);
      }
    }

    if (removedAccountIds.length > 0) {
      const toRemap = allBalanceEntries.filter((e) => removedAccountIds.includes(e.accountId));
      for (const e of toRemap) {
        await db.balanceEntries.update(e.id, { accountId: accountIdRemap[e.accountId] });
      }

      // A transfer's OTHER leg can reference a removed duplicate account
      // via counterpartAccountId even when this leg's own accountId didn't
      // need remapping - checked independently of the accountId remap
      // above rather than only for entries already caught by it.
      const transfersReferencingRemoved = allBalanceEntries.filter(
        (e) => e.type === "transfer" && e.counterpartAccountId != null && removedAccountIds.includes(e.counterpartAccountId)
      );
      for (const e of transfersReferencingRemoved) {
        await db.balanceEntries.update(e.id, { counterpartAccountId: accountIdRemap[e.counterpartAccountId] });
      }

      // Any OTHER account whose costCurrencyAccountId points at a removed
      // duplicate (e.g. a stock account priced against a USD wallet that
      // just got deduped) needs that reference remapped too - otherwise it
      // would dangle, pointing at a deleted account id.
      const accountsReferencingRemoved = allAccounts.filter(
        (a) => a.costCurrencyAccountId != null && removedAccountIds.includes(a.costCurrencyAccountId)
      );
      for (const a of accountsReferencingRemoved) {
        await db.accounts.update(a.id, { costCurrencyAccountId: accountIdRemap[a.costCurrencyAccountId] });
      }

      // Real transactions linked via "Paid From" also reference accounts
      // directly (separate table from balanceEntries) - same remap, so a
      // linked transaction never ends up pointing at a deleted account id.
      const transactionsAfterTxWrite = await db.transactions.toArray();
      const transactionsReferencingRemoved = transactionsAfterTxWrite.filter(
        (t) => t.accountId != null && removedAccountIds.includes(t.accountId)
      );
      for (const t of transactionsReferencingRemoved) {
        await db.transactions.update(t.id, { accountId: accountIdRemap[t.accountId] });
      }

      await db.accounts.bulkDelete(removedAccountIds);
    }

    // Balance entries duplicated by full content - remapping above can
    // itself create fresh duplicates (two old accounts each had the same
    // starting-balance reconciliation, both now point at the same
    // retained account).
    const balanceEntriesAfterRemap = await db.balanceEntries.toArray();
    const balanceEntryDupes = findDuplicateGroups(balanceEntriesAfterRemap, balanceEntryFingerprint);
    const removedBalanceEntryIds = balanceEntryDupes.flatMap(({ remove }) => remove.map((e) => e.id));
    if (removedBalanceEntryIds.length > 0) {
      await db.balanceEntries.bulkDelete(removedBalanceEntryIds);
    }

    // =====================================================================
    // Step 9: Account Types - same name-based dedup shape as buckets/
    // accounts above. `typeId` lives directly on the account row, so the
    // remap here is a single db.accounts.update per affected account,
    // simpler than the balanceEntries join-less-but-FK-bearing case above.
    // =====================================================================
    const accountTypeDupes = findDuplicateGroups(allAccountTypes, accountTypeFingerprint);
    const accountTypeIdRemap = {};
    const removedAccountTypeIds = [];
    for (const { keep, remove } of accountTypeDupes) {
      for (const t of remove) {
        accountTypeIdRemap[t.id] = keep.id;
        removedAccountTypeIds.push(t.id);
      }
    }

    if (removedAccountTypeIds.length > 0) {
      const accountsAfterAccountRemap = await db.accounts.toArray();
      const toRemap = accountsAfterAccountRemap.filter((a) => removedAccountTypeIds.includes(a.typeId));
      for (const a of toRemap) {
        await db.accounts.update(a.id, { typeId: accountTypeIdRemap[a.typeId] });
      }
      await db.accountTypes.bulkDelete(removedAccountTypeIds);
    }

    return {
      yearsRemoved: removedYearIds.length,
      monthsRemoved: removedMonthIds.length,
      daysRemoved: removedDayIds.length,
      transactionsRemoved: removedTxIds.length,
      bucketsRemoved: removedBucketIds.length,
      assignmentsRemoved: removedAssignmentIds.length,
      accountsRemoved: removedAccountIds.length,
      balanceEntriesRemoved: removedBalanceEntryIds.length,
      accountTypesRemoved: removedAccountTypeIds.length,
    };
  };

  const commitImport = withErrorHandling("commitImport", async (data) => {
    const { years, months, days, transactions, travels, buckets, bucketAssignments, accounts, balanceEntries, accountTypes } =
      data;

    await db.travels.bulkPut(travels);
    await db.buckets.bulkPut(buckets);
    await db.bucketAssignments.bulkPut(bucketAssignments);
    await db.years.bulkPut(years);
    await db.months.bulkPut(months);
    await db.days.bulkPut(days);
    await db.transactions.bulkPut(transactions);
    await db.accountTypes.bulkPut(accountTypes);
    await db.accounts.bulkPut(accounts);
    await db.balanceEntries.bulkPut(balanceEntries);

    const cleanup = await cleanupDuplicatesAfterImport();

    await reloadHierarchy();
    await reloadAssets();

    return { cleanup };
  });

  // -------------------------
  // Categories helper (derived from the shared allTransactions list)
  // -------------------------
  const categories = useMemo(() => {
    const cats = new Set(allTransactions.map((t) => t.category).filter(Boolean));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [allTransactions]);

  // ---------------------------
  // Bucket operations
  // ---------------------------
  const addBucket = withErrorHandling("addBucket", async (name) => {
    return await db.buckets.add({ name });
  });

  const removeBucket = withErrorHandling("removeBucket", async (id) => {
    await db.bucketAssignments.where({ bucketId: id }).delete();
    await db.buckets.delete(id);
  });

  const assignToBucket = withErrorHandling("assignToBucket", async (bucketId, category) => {
    const assignments = await db.bucketAssignments.where({ category }).toArray();

    const alreadyAssignedToThisBucket = assignments.some((a) => a.bucketId === bucketId);

    if (alreadyAssignedToThisBucket) {
      // Already assigned to this bucket -> remove it (uncheck)
      await db.bucketAssignments.where({ bucketId, category }).delete();
    } else {
      // Remove from any other bucket and assign to this one (categories
      // belong to exactly one bucket at a time)
      await db.bucketAssignments.where({ category }).delete();
      await db.bucketAssignments.add({ bucketId, category });
    }
  });

  const getBucketsWithCategories = async () => {
    try {
      const buckets = await db.buckets.toArray();
      const assignments = await db.bucketAssignments.toArray();

      return (buckets || []).map((b) => ({
        ...b,
        categories: (assignments || [])
          .filter((a) => a.bucketId === b.id)
          .map((a) => a.category),
      }));
    } catch (err) {
      console.error("[ExpenseContext] getBucketsWithCategories failed:", err);
      return [];
    }
  };

  // Removes bucket assignments for categories that no longer exist on any
  // transaction (e.g. the transaction was deleted, or the category was
  // renamed). Fetches categories directly from DB to avoid closure issues
  // with potentially stale/empty `categories` memo.
  const cleanBucketAssignments = withErrorHandling("cleanBucketAssignments", async () => {
    const assignments = await db.bucketAssignments.toArray();
    
    // Get current categories directly from DB to avoid stale closure
    const allTx = await db.transactions.toArray();
    const existingCategories = new Set(allTx.map((t) => t.category).filter(Boolean));

    // Only delete assignments if we actually have transactions (avoid wiping on empty load)
    if (allTx.length === 0) return;

    const invalidAssignments = assignments.filter((a) => !existingCategories.has(a.category));

    if (invalidAssignments.length > 0) {
      await db.bucketAssignments.bulkDelete(invalidAssignments.map((a) => a.id));
    }
  });

  const value = {
    years,
    travels,
    allTransactions,

    addYear,
    removeYear,
    addMonth,
    removeMonth,
    addDay,
    removeDay,

    addTransaction,
    updateTransaction,
    removeTransaction,

    addTravel,
    updateTravel,
    removeTravel,
    getTravelTransactions,

    getYearId,
    getMonthId,
    clearDB,
    exportExpenses,
    parseImportFile,
    commitImport,

    addBucket,
    removeBucket,
    assignToBucket,
    getBucketsWithCategories,
    cleanBucketAssignments,

    categories,

    // Assets feature
    accounts,
    balanceEntries,
    addAccount,
    updateAccount,
    removeAccount,
    addIncomeEntry,
    addReconciliation,
    addStatementClose,
    addConvertEntry,
    addMarkPrice,
    addTransfer,
    removeBalanceEntry,
    incomeCategories,

    // Account Types (classifications)
    accountTypes,
    addAccountType,
    updateAccountType,
    removeAccountType,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export const useExpenseContext = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenseContext must be used within an ExpenseProvider");
  return ctx;
};
