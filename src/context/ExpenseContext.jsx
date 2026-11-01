// src/context/ExpenseContext.jsx
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { db } from "./db";
import { normalizeTravelId } from "../utils/travelHelpers";
import { validateImportShape, MAX_IMPORT_BYTES } from "../utils/importValidation";
import { IMPORT_TABLES, planImport, applyImportResolutions, sameConflicts } from "../utils/importPlan";
import { needsRekey, rekeyTables } from "../utils/rekey";
import { shadowEntryFor, buildShadowEntries } from "../utils/shadowEntries";
import { getAccessToken, clearAccessToken, revokeAccess } from "../sync/googleAuth";
import * as drive from "../sync/driveClient";
import { buildSnapshot, parseSnapshot, hashTables, hashRecord } from "../sync/snapshot";
import { mergeSnapshots, applyRecordResolutions } from "../sync/mergeSnapshots";
import { SyncRetryError } from "../sync/errors";
import { isOldestReconciliation, getCurrentBalance, getCurrentValuePhp } from "../utils/balanceHelpers";
import { ALL_MONTHS, formatDate } from "../utils/dateHelpers";
import { findTagConflict, tagConflictMessage, mergeTransactionRows } from "../utils/transactionMerge";

const ExpenseContext = createContext();

const SYNC_STATE_KEY = "drive";

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

// Runs fn as a (sub-)transaction so callers await a Dexie promise. Awaiting a
// bare native async helper inside a transaction can drop Dexie's zone.
const inTx = (fn) => (...args) => db.transaction("rw", db.tables, () => fn(...args));

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  // Bumped whenever data is reloaded after a change; auto-sync debounces on it.
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((v) => v + 1);

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
    bumpDataVersion();
  };

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
    bumpDataVersion();
  };

  useEffect(() => {
    let active = true;
    Promise.all([reloadHierarchy(), reloadAssets()]).then(() => {
      if (active) setIsLoaded(true);
    });
    db.syncState.get(SYNC_STATE_KEY).then((state) => {
      if (active && state) setSyncStatus({ lastSyncedAt: state.lastSyncedAt });
    });
    return () => {
      active = false;
    };
  }, []);

  // Single computed flat list of every transaction, derived from `years`.
  // Exposed so pages don't each re-flatten the hierarchy themselves.
  const allTransactions = useMemo(() => flattenTransactions(years), [years]);

  // Runs fn in one Dexie transaction across every table, then reloads state
  // once after commit. fn must only await Dexie promises.
  const atomic = (label, fn) =>
    withErrorHandling(label, async (...args) => {
      const result = await db.transaction("rw", db.tables, () => fn(...args));
      await Promise.all([reloadHierarchy(), reloadAssets()]);
      return result;
    });

  // Idempotent, non-reloading year/month/day lookups for use inside batches.
  const ensureYear = inTx(async (yearNumber) => {
    const existing = await db.years.where({ year: yearNumber }).first();
    if (existing) return existing.id;
    return await db.years.add({ year: yearNumber, createdAt: new Date() });
  });

  const ensureMonth = inTx(async (yearId, name) => {
    const existing = await db.months.where("[yearId+name]").equals([yearId, name]).first();
    if (existing) return existing.id;
    return await db.months.add({ yearId, name, createdAt: new Date() });
  });

  const ensureDay = inTx(async (yearId, monthId, dayNumber) => {
    const existing = await db.days
      .where("[yearId+monthId+day]")
      .equals([yearId, monthId, dayNumber])
      .first();
    if (existing) return existing.id;
    return await db.days.add({ yearId, monthId, day: dayNumber, createdAt: new Date() });
  });

  // ---------------------------
  // Year operations
  // ---------------------------
  const addYear = withErrorHandling("addYear", async (yearNumber) => {
    const yearId = await ensureYear(yearNumber);
    await reloadHierarchy();
    return yearId;
  });

  const removeYear = withErrorHandling("removeYear", async (yearId) => {
    await db.transaction("rw", db.tables, async () => {
      const transactions = await db.transactions.where({ yearId }).toArray();
      const transactionIds = new Set(transactions.map((t) => t.id));
      const shadows = await db.balanceEntries
        .filter((e) => e.type === "expense" && transactionIds.has(e.sourceTransactionId))
        .toArray();
      await db.balanceEntries.bulkDelete(shadows.map((e) => e.id));
      await db.transactions.where({ yearId }).delete();
      await db.days.where({ yearId }).delete();
      await db.months.where({ yearId }).delete();
      await db.years.delete(yearId);
    });
    await reloadHierarchy();
    await reloadAssets();
  });

  // ---------------------------
  // Month operations
  // ---------------------------
  const addMonth = withErrorHandling("addMonth", async (yearId, name) => {
    const monthId = await ensureMonth(yearId, name);
    await reloadHierarchy();
    return monthId;
  });

  const removeMonth = withErrorHandling("removeMonth", async (monthId) => {
    await db.transaction("rw", db.tables, async () => {
      const transactions = await db.transactions.where({ monthId }).toArray();
      const transactionIds = new Set(transactions.map((t) => t.id));
      const shadows = await db.balanceEntries
        .filter((e) => e.type === "expense" && transactionIds.has(e.sourceTransactionId))
        .toArray();
      await db.balanceEntries.bulkDelete(shadows.map((e) => e.id));
      await db.transactions.where({ monthId }).delete();
      await db.days.where({ monthId }).delete();
      await db.months.delete(monthId);
    });
    await reloadHierarchy();
    await reloadAssets();
  });

  // ---------------------------
  // Day operations
  // ---------------------------
  const addDay = withErrorHandling("addDay", async (yearId, monthId, dayNumber) => {
    const dayId = await ensureDay(yearId, monthId, dayNumber);
    await reloadHierarchy();
    return dayId;
  });

  const removeDay = withErrorHandling("removeDay", async (dayId) => {
    await db.transaction("rw", db.tables, async () => {
      const transactions = await db.transactions.where({ dayId }).toArray();
      const transactionIds = new Set(transactions.map((t) => t.id));
      const shadows = await db.balanceEntries
        .filter((e) => e.type === "expense" && transactionIds.has(e.sourceTransactionId))
        .toArray();
      await db.balanceEntries.bulkDelete(shadows.map((e) => e.id));
      await db.transactions.where({ dayId }).delete();
      await db.days.delete(dayId);
    });
    await reloadHierarchy();
    await reloadAssets();
  });

  // Resolves the real calendar Date for a transaction's (yearId, monthId,
  // dayId). Transactions themselves only store those three ids - the
  // enriched dayNumber/monthName/yearNumber fields every page reads are
  // computed in reloadHierarchy(), which a mid-write helper can't rely on
  // being fresh. Returns null if any of the three rows is missing (never
  // trusts stored ids blindly).
  const resolveTransactionDate = inTx(async (yearId, monthId, dayId) => {
    const [year, month, day] = await Promise.all([
      db.years.get(yearId),
      db.months.get(monthId),
      db.days.get(dayId),
    ]);
    if (!year || !month || !day) return null;
    return new Date(year.year, ALL_MONTHS.indexOf(month.name), day.day);
  });

  // Keeps a transaction's shadow "expense" balanceEntries row in sync with
  // whatever the transaction currently looks like (see db.js v8 / Balance
  // Transfers' addTransfer for the same paired-entry pattern). Always
  // fully regenerated - delete then recreate - rather than patched
  // incrementally, so the two can never quietly drift apart. A no-op if
  // there was no shadow and the transaction isn't linked either way.
  // Called after every add/update/delete on a transaction.
  const syncShadowExpenseEntry = inTx(async (transactionId) => {
    const existingShadow = await db.balanceEntries
      .filter((e) => e.type === "expense" && e.sourceTransactionId === transactionId)
      .first();
    if (existingShadow) await db.balanceEntries.delete(existingShadow.id);

    const transaction = await db.transactions.get(transactionId);
    if (!transaction || transaction.accountId == null) return; // deleted, or not linked - nothing to shadow

    const date = await resolveTransactionDate(transaction.yearId, transaction.monthId, transaction.dayId);
    if (!date) return; // orphaned year/month/day - shouldn't happen, but never assumed

    await db.balanceEntries.add(shadowEntryFor(transaction, date));
  });

  // ---------------------------
  // Transaction operations
  // ---------------------------

  // Merges `incoming` into the existing same-day/same-category row (the
  // unique index allows only one) via amountBreakdown, refusing if their
  // travel/account tags disagree.
  const mergeIntoExisting = inTx(async (existing, incoming) => {
    const conflict = findTagConflict(existing, incoming);
    if (conflict) {
      const [date, allTravels, allAccounts] = await Promise.all([
        resolveTransactionDate(existing.yearId, existing.monthId, existing.dayId),
        db.travels.toArray(),
        db.accounts.toArray(),
      ]);
      throw new Error(
        tagConflictMessage({
          category: existing.category,
          dateLabel: formatDate(date),
          conflict,
          travels: allTravels,
          accounts: allAccounts,
        })
      );
    }
    await db.transactions.update(existing.id, mergeTransactionRows(existing, incoming));
    await syncShadowExpenseEntry(existing.id);
    return existing.id;
  });

  const findDayCategoryRow = (yearId, monthId, dayId, category) =>
    db.transactions
      .where("[yearId+monthId+dayId+category]")
      .equals([yearId, monthId, dayId, category])
      .first();

  // Non-reloading add-or-merge, for use inside a batch.
  const writeTransaction = inTx(async (yearId, monthId, dayId, transaction) => {
    const existing = await findDayCategoryRow(yearId, monthId, dayId, transaction.category);
    if (existing) return mergeIntoExisting(existing, transaction);

    const id = await db.transactions.add({
      ...transaction,
      yearId,
      monthId,
      dayId,
      travelId: normalizeTravelId(transaction.travelId),
      accountId: transaction.accountId ?? null,
      createdAt: new Date(),
    });
    await syncShadowExpenseEntry(id);
    return id;
  });

  // Non-reloading delete, for use inside a batch.
  const deleteTransactionRow = inTx(async (transactionId) => {
    const tx = await db.transactions.get(transactionId);
    await db.transactions.delete(transactionId);
    await syncShadowExpenseEntry(transactionId); // transaction's gone - this just cleans up any shadow it had

    // Reverse of removeBalanceEntry's fee-cascade below: if this
    // transaction carried one or more auto-logged fee contributions (see
    // addConvertEntry/addTransfer's sourceBalanceEntryIds), clear `fee` on
    // each source balance entry. The convert/transfer event itself stays
    // intact - units, costBasis, and the transfer amount are all real and
    // unrelated to the fee - only the fee summary is cleared, since its
    // own expense record is what just disappeared.
    const feeSourceIds = tx?.sourceBalanceEntryIds?.filter((id) => id != null) || [];
    for (const beId of feeSourceIds) {
      await db.balanceEntries.update(beId, { fee: null });
    }
  });

  const addTransaction = atomic("addTransaction", (yearId, monthId, dayId, transaction) =>
    writeTransaction(yearId, monthId, dayId, transaction)
  );

  const updateTransaction = atomic("updateTransaction", async (transactionId, updatedFields) => {
    const normalizedFields =
      "travelId" in updatedFields
        ? { ...updatedFields, travelId: normalizeTravelId(updatedFields.travelId) }
        : updatedFields;
    await db.transactions.update(transactionId, normalizedFields);
    await syncShadowExpenseEntry(transactionId);
  });

  const removeTransaction = atomic("removeTransaction", (transactionId) => deleteTransactionRow(transactionId));

  // Edits one transaction, optionally moving it to `date`; lands on an existing
  // same-day/category row by merging into it, like the day editor does.
  const editTransaction = atomic("editTransaction", async (transactionId, { date, ...fields }) => {
    const current = await db.transactions.get(transactionId);
    if (!current) throw new Error("This transaction no longer exists.");

    const d = new Date(date);
    const yearId = await ensureYear(d.getFullYear());
    const monthId = await ensureMonth(yearId, ALL_MONTHS[d.getMonth()]);
    const dayId = await ensureDay(yearId, monthId, d.getDate());
    const normalized = {
      ...fields,
      travelId: normalizeTravelId(fields.travelId),
      accountId: fields.accountId ?? null,
    };

    const target = await findDayCategoryRow(yearId, monthId, dayId, normalized.category);
    let resultId = transactionId;
    if (target && target.id !== transactionId) {
      resultId = await mergeIntoExisting(target, { ...current, ...normalized });
      await db.transactions.delete(transactionId);
    } else {
      await db.transactions.update(transactionId, { ...normalized, yearId, monthId, dayId });
    }
    await syncShadowExpenseEntry(transactionId);

    if (current.dayId !== dayId && (await db.transactions.where({ dayId: current.dayId }).count()) === 0) {
      await db.days.delete(current.dayId);
    }
    return resultId;
  });

  // Saves one day's Add/Edit modal session in a single transaction: deletes,
  // updates to existing rows (`id` set), and new rows (merged per category).
  // Pass `date` instead of ids to resolve/create the year/month/day.
  // Removes the day if it ends up empty.
  const saveDayTransactions = atomic(
    "saveDayTransactions",
    async ({ yearId, monthId, dayId, date = null, deletes = [], upserts = [] }) => {
      if (date) {
        const d = new Date(date);
        yearId = await ensureYear(d.getFullYear());
        monthId = await ensureMonth(yearId, ALL_MONTHS[d.getMonth()]);
        dayId = await ensureDay(yearId, monthId, d.getDate());
      }

      for (const id of deletes) await deleteTransactionRow(id);

      const normalize = (fields) => ({
        ...fields,
        travelId: normalizeTravelId(fields.travelId),
        accountId: fields.accountId ?? null,
      });
      const updates = upserts.filter((u) => u.id != null);
      const inserts = upserts.filter((u) => u.id == null);

      // Placeholder categories let rows swap categories without tripping the unique index.
      for (const { id } of updates) {
        await db.transactions.update(id, { category: `\u0000pending:${id}` });
      }

      for (const { id, ...fields } of updates) {
        const normalized = normalize(fields);
        const target = await findDayCategoryRow(yearId, monthId, dayId, normalized.category);
        if (target) {
          const current = await db.transactions.get(id);
          await mergeIntoExisting(target, { ...current, ...normalized });
          await db.transactions.delete(id);
          await syncShadowExpenseEntry(id);
        } else {
          await db.transactions.update(id, normalized);
          await syncShadowExpenseEntry(id);
        }
      }

      for (const fields of inserts) {
        await writeTransaction(yearId, monthId, dayId, normalize(fields));
      }

      const remaining = await db.transactions.where({ dayId }).count();
      if (remaining === 0) await db.days.delete(dayId);

      return { yearId, monthId, dayId };
    }
  );

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
        createdAt: new Date(),
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
        createdAt: new Date(),
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
          // Must sort after the same-day anchor reconciliation above.
          createdAt: new Date(Date.now() + 1),
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
          createdAt: new Date(),
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
    await db.transaction("rw", db.tables, async () => {
      const account = await db.accounts.get(accountId);
      if (!account) return;

      const allAccounts = await db.accounts.toArray();
      const pricedAccounts = allAccounts.filter(
        (a) => a.id !== accountId && a.costCurrencyAccountId === accountId
      );
      if (pricedAccounts.length) {
        throw new Error(
          `Can't delete: ${pricedAccounts.map((a) => a.name).join(", ")} are priced in this account. Reassign or delete them first.`
        );
      }

      const allEntries = await db.balanceEntries.toArray();
      const deletedEntries = allEntries.filter((e) => e.accountId === accountId);
      const groups = new Set(
        deletedEntries.map((e) => e.transferGroupId).filter(Boolean)
      );
      for (const transferGroupId of groups) {
        const counterpartEntries = allEntries.filter(
          (e) => e.transferGroupId === transferGroupId && e.accountId !== accountId
        );
        for (const entry of counterpartEntries) {
          const suffix = ` (counterpart account '${account.name}' deleted)`;
          await db.balanceEntries.update(entry.id, {
            counterpartAccountId: null,
            transferGroupId: null,
            comments: `${entry.comments || ""}${suffix}`,
          });
        }
      }

      await cascadeRemoveFeeContributions(deletedEntries.map((e) => e.id));
      await db.balanceEntries.bulkDelete(deletedEntries.map((e) => e.id));
      await db.transactions.where({ accountId }).modify({ accountId: null });
      await db.accounts.delete(accountId);
    });
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
        createdAt: new Date(),
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
        createdAt: new Date(),
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
        createdAt: new Date(),
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
  //
  // sourceAccountId (optional): the account the money actually came from.
  // Without it, Convert only ever credited the destination - the source
  // account's book balance silently stayed overstated by whatever was
  // spent, since the documented "Transfer-then-Convert" workaround is
  // actually impossible: addTransfer refuses same-unit-only, and a
  // foreign destination's unit is by definition not the source's. Passing
  // sourceAccountId debits that account for costBasis + fee (in its own
  // currency) at the same moment, so both sides of the conversion land in
  // one action. Omitting it keeps the old destination-only behavior
  // exactly as before - fully backward compatible.
  const addConvertEntry = atomic(
    "addConvertEntry",
    async (accountId, { date, amount, costBasis, fee = null, feeCategory = null, comments, sourceAccountId = null }) => {
      const feeAmt = fee != null && fee !== "" ? Number(fee) : null;
      let transferGroupId = null;

      if (sourceAccountId != null) {
        const allAccountsForCheck = await db.accounts.toArray();
        const destAccount = allAccountsForCheck.find((a) => a.id === accountId);
        const sourceAccount = allAccountsForCheck.find((a) => a.id === sourceAccountId);
        if (!sourceAccount) throw new Error("Funding source account not found.");

        // The source must actually hold the currency costBasis is
        // denominated in - PHP if the destination is priced directly in
        // PHP, or whatever the destination's costCurrencyAccountId's unit
        // is otherwise (e.g. a USD wallet funding a VOO purchase).
        const requiredUnit =
          destAccount?.costCurrencyAccountId != null
            ? allAccountsForCheck.find((a) => a.id === destAccount.costCurrencyAccountId)?.unit ?? null
            : null;

        if ((sourceAccount.unit || null) !== (requiredUnit || null)) {
          throw new Error(
            `Funding source must be in ${requiredUnit || "PHP"} to match this account's cost currency.`
          );
        }

        transferGroupId = `conv_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      }

      // Fee-to-PHP rate, computed BEFORE either balance entry below is
      // written. account.costCurrencyAccountId is very often the SAME
      // account as sourceAccountId (e.g. VOO's cost currency is IBKR USD,
      // funded FROM IBKR USD) - fetching this lookup after the
      // funding-source debit leg was written (the original bug here, same
      // root cause as addTransfer's) would mean a purchase spending all or
      // nearly all of what's in the funding account makes refUnits come
      // back at or near zero, silently failing the conversion on exactly
      // the purchases that most need it converted.
      let feeInPhp = feeAmt != null ? feeAmt : 0;
      let feeNote = "";
      // Hoisted out of the block below: the fee transaction's comment text
      // further down reads account?.name, and a const declared inside the
      // if-block isn't visible there (that was the ReferenceError behind
      // "saving failed" whenever a fee was entered).
      let account = null;
      if (feeAmt != null && feeAmt > 0) {
        const [allAccounts, allEntries] = await Promise.all([db.accounts.toArray(), db.balanceEntries.toArray()]);
        account = allAccounts.find((a) => a.id === accountId);

        if (account?.costCurrencyAccountId != null) {
          // Fee is in a foreign currency - convert to PHP via the same
          // chained lookup used everywhere else, at the conversion date.
          const refUnits = getCurrentBalance(allEntries, account.costCurrencyAccountId, new Date(date));
          const refValuePhp = getCurrentValuePhp(allEntries, allAccounts, account.costCurrencyAccountId, new Date(date));
          if (refUnits && refValuePhp != null) {
            const rate = refValuePhp / refUnits;
            feeInPhp = feeAmt * rate;
            feeNote = ` ($${feeAmt.toFixed(2)} \u2248 \u20b1${feeInPhp.toFixed(2)})`;
          }
        }
      }

      const id = await db.balanceEntries.add({
        accountId,
        date: new Date(date),
        type: "convert",
        amount: Number(amount),
        balance: null,
        costBasis: Number(costBasis),
        fee: feeAmt,
        pricePerUnit: null,
        category: null,
        comments: comments?.trim() || "",
        createdAt: new Date(),
        ...(transferGroupId ? { transferGroupId, counterpartAccountId: sourceAccountId } : {}),
      });

      // Debit the funding source, in its own currency, for what actually
      // left it (cost basis + fee). Deliberately typed "transfer", not
      // "convert" - getLatestPrice/getAverageCost read the most recent
      // "convert" entry on an account as an implied price mark, and this
      // leg carries no price information of its own; typing it "convert"
      // would corrupt the source's own valuation whenever the source is
      // itself a foreign-asset account (e.g. debiting a USD broker to fund
      // a VOO purchase). "transfer" is already folded into the balance
      // walk (getInflowEntries) and already ignored by price/cost-basis
      // logic, so this reuses proven machinery instead of adding a new
      // entry type. Shares transferGroupId with the convert entry above so
      // removeBalanceEntry's paired-delete logic (broadened below) removes
      // both legs together, regardless of which one is deleted from.
      if (sourceAccountId != null) {
        await db.balanceEntries.add({
          accountId: sourceAccountId,
          date: new Date(date),
          type: "transfer",
          amount: -(Number(costBasis) + (feeAmt || 0)),
          balance: null,
          costBasis: null,
          fee: null,
          pricePerUnit: null,
          category: null,
          comments: comments?.trim() || "",
          transferGroupId,
          counterpartAccountId: accountId,
          createdAt: new Date(),
        });
      }

      // Fee auto-logging - the one deliberate exception to accounts and
      // expenses staying independent (foreign-assets-plan.md §5), scoped
      // narrowly to conversion fees. Skipped entirely if no fee was given,
      // so this changes nothing for a plain conversion.
      //
      // Linked back to this convert entry via sourceBalanceEntryIds (see
      // below) - deleting the convert entry now cascades to remove or
      // shrink the fee transaction it created, via removeBalanceEntry.
      // feeInPhp/feeNote were already computed above, from pre-conversion
      // balance data.
      if (fee != null && fee !== "" && Number(fee) > 0) {
        const feeDate = new Date(date);
        const category = feeCategory?.trim() || "Fees";

        const yearId = await ensureYear(feeDate.getFullYear());
        const monthId = await ensureMonth(yearId, ALL_MONTHS[feeDate.getMonth()]);
        const dayId = await ensureDay(yearId, monthId, feeDate.getDate());

        // The transactions table enforces one row per (day, category) -
        // merge into an existing same-day/same-category row (via the
        // amount-breakdown feature) rather than risking addTransaction's
        // own idempotent existence-check silently dropping a second fee.
        const existingFeeTx = await db.transactions
          .where("[yearId+monthId+dayId+category]")
          .equals([yearId, monthId, dayId, category])
          .first();

        // sourceBalanceEntryIds is a parallel array to amountBreakdown -
        // same index = same contribution, null for any breakdown item that
        // isn't a linked auto-fee (e.g. a manually-entered amount that
        // happened to land on the same day+category). This is the "proper
        // FK" flagged as future work above - removeBalanceEntry can now
        // find and unwind exactly this fee's slice later without
        // disturbing anything else merged into the same row.
        if (existingFeeTx) {
          const newBreakdown = [...(existingFeeTx.amountBreakdown || [existingFeeTx.amount]), feeInPhp];
          const priorSourceIds =
            existingFeeTx.sourceBalanceEntryIds || (existingFeeTx.amountBreakdown || [existingFeeTx.amount]).map(() => null);
          const newSourceIds = [...priorSourceIds, id];
          await db.transactions.update(existingFeeTx.id, {
            amount: newBreakdown.reduce((s, v) => s + Number(v), 0),
            amountBreakdown: newBreakdown,
            sourceBalanceEntryIds: newSourceIds,
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
            sourceBalanceEntryIds: [id],
            comments: `Auto-logged: ${account?.name || "account"} conversion fee${feeNote}`,
            travelId: null,
            createdAt: new Date(),
          });
        }
      }

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
        createdAt: new Date(),
      });
      await reloadAssets();
      return id;
    }
  );

  // Transfer: moves units between two of the user's own accounts. Unlike
  // Convert, this never changes what the units *are* - both legs must
  // share the same `unit` (null == null counts, i.e. two ordinary PHP
  // accounts). Crossing currencies is a Convert instead - pick this
  // account as Convert's Funding Source on the destination account (see
  // addConvertEntry's sourceAccountId), which debits it directly, in the
  // same action that credits the destination.
  //
  // Written as two balanceEntries rows (type "transfer") linked by a
  // generated transferGroupId: a negative-amount leg on the source
  // account, a positive-amount leg on the destination. Deliberately NOT
  // logged as "income" on the destination or implied-spend on the source -
  // getInflowEntries in balanceHelpers.js folds both legs into the normal
  // balance walk so neither side is misreported.
  //
  // fee (optional, in the transfer's own unit): a same-currency transfer
  // can still cost something (a wire fee, a deposit fee) - the outgoing
  // leg reflects the full amount that actually left the source, the
  // incoming leg reflects amount - fee (what actually arrived), same
  // real-world shape as a wire transfer. The fee itself is auto-logged as
  // a PHP expense, same "chain to PHP via the account's own valuation,
  // merge into a same-day/same-category transaction" pattern as
  // addConvertEntry's fee handling. Omitting fee keeps the old behavior
  // exactly as before.
  const addTransfer = atomic(
    "addTransfer",
    async (fromAccountId, toAccountId, { date, amount, comments, fee = null, feeCategory = null }) => {
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
      const feeAmt = fee != null && fee !== "" ? Number(fee) : 0;
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Transfer amount must be greater than zero.");
      if (!Number.isFinite(feeAmt) || feeAmt < 0 || feeAmt >= amt) {
        throw new Error("The fee must be less than the transfer amount.");
      }
      const trimmedComments = comments?.trim() || "";
      const entryDate = new Date(date);

      // Fee-to-PHP rate, computed from balance data as it stood BEFORE this
      // transfer's own two legs are written below. Fetching this AFTER
      // outId/inId exist (the original bug here) would include this
      // transfer's own outgoing debit in the balance lookup - meaning a
      // transfer that sends out all or nearly all of what's in the
      // account (exactly the "convert then immediately pass onward"
      // pattern) makes refUnits come back at or near zero, silently
      // failing the conversion guard below on precisely the transfers
      // that most need it. getCurrentValuePhp already walks any
      // costCurrencyAccountId chain internally, so this one call correctly
      // handles a plain PHP account (unit null -> rate 1), a foreign
      // account priced directly in PHP, or a foreign account priced
      // through another foreign account, without needing separate
      // branches for each.
      let feeInPhp = feeAmt;
      let feeNote = "";
      if (feeAmt > 0 && fromAccount.unit != null) {
        const entriesBeforeThisTransfer = await db.balanceEntries.toArray();
        const refUnits = getCurrentBalance(entriesBeforeThisTransfer, fromAccountId, entryDate);
        const refValuePhp = getCurrentValuePhp(entriesBeforeThisTransfer, allAccounts, fromAccountId, entryDate);
        if (refUnits && refValuePhp != null) {
          const rate = refValuePhp / refUnits;
          feeInPhp = feeAmt * rate;
          feeNote = ` (${fromAccount.unit} ${feeAmt.toFixed(2)} \u2248 \u20b1${feeInPhp.toFixed(2)})`;
        }
      }

      const outId = await db.balanceEntries.add({
        accountId: fromAccountId,
        date: entryDate,
        type: "transfer",
        amount: -amt,
        balance: null,
        costBasis: null,
        fee: feeAmt || null,
        pricePerUnit: null,
        category: null,
        comments: trimmedComments,
        transferGroupId,
        counterpartAccountId: toAccountId,
        createdAt: new Date(),
      });

      const inId = await db.balanceEntries.add({
        accountId: toAccountId,
        date: entryDate,
        type: "transfer",
        amount: amt - feeAmt,
        balance: null,
        costBasis: null,
        fee: null,
        pricePerUnit: null,
        category: null,
        comments: trimmedComments,
        transferGroupId,
        counterpartAccountId: fromAccountId,
        createdAt: new Date(),
      });

      // Fee auto-logging - skipped entirely if no fee was given, so this
      // changes nothing for a plain transfer. Linked back to the "out" leg
      // via sourceBalanceEntryIds, same as Convert's fee logging above -
      // deleting either transfer leg cascades to remove/shrink this fee's
      // transaction via removeBalanceEntry. feeInPhp/feeNote were already
      // computed above, from pre-transfer balance data.
      if (feeAmt > 0) {
        const feeDate = entryDate;
        const category = feeCategory?.trim() || "Fees";

        const yearId = await ensureYear(feeDate.getFullYear());
        const monthId = await ensureMonth(yearId, ALL_MONTHS[feeDate.getMonth()]);
        const dayId = await ensureDay(yearId, monthId, feeDate.getDate());

        const existingFeeTx = await db.transactions
          .where("[yearId+monthId+dayId+category]")
          .equals([yearId, monthId, dayId, category])
          .first();

        if (existingFeeTx) {
          const newBreakdown = [...(existingFeeTx.amountBreakdown || [existingFeeTx.amount]), feeInPhp];
          const priorSourceIds =
            existingFeeTx.sourceBalanceEntryIds || (existingFeeTx.amountBreakdown || [existingFeeTx.amount]).map(() => null);
          const newSourceIds = [...priorSourceIds, outId];
          await db.transactions.update(existingFeeTx.id, {
            amount: newBreakdown.reduce((s, v) => s + Number(v), 0),
            amountBreakdown: newBreakdown,
            sourceBalanceEntryIds: newSourceIds,
            comments: existingFeeTx.comments
              ? `${existingFeeTx.comments}; auto-logged fee${feeNote}`
              : `Auto-logged: ${fromAccount.name} transfer fee${feeNote}`,
          });
        } else {
          await db.transactions.add({
            yearId,
            monthId,
            dayId,
            category,
            amount: feeInPhp,
            amountBreakdown: [feeInPhp],
            sourceBalanceEntryIds: [outId],
            comments: `Auto-logged: ${fromAccount.name} transfer fee${feeNote}`,
            travelId: null,
            createdAt: new Date(),
          });
        }
      }

      return { transferGroupId, outId, inId };
    }
  );

  // Un-merges (or deletes outright) whichever fee transaction(s) the given
  // balance entries fed - see addConvertEntry/addTransfer's
  // sourceBalanceEntryIds. Deliberately un-merges rather than blindly
  // deleting: a transaction that combined this fee with a manually-entered
  // amount, or with another fee from a different day's entry, only loses
  // ITS slice - the row is only deleted outright if this was the only
  // thing contributing to it. Not indexed (sourceBalanceEntryIds is a
  // plain array field, same precedent as transferGroupId/sourceTransactionId
  // elsewhere in this schema), so this filters in memory like those do.
  const cascadeRemoveFeeContributions = inTx(async (deletedEntryIds) => {
    if (!deletedEntryIds || deletedEntryIds.length === 0) return;
    const allTx = await db.transactions.toArray();
    const affected = allTx.filter((t) =>
      t.sourceBalanceEntryIds?.some((sid) => deletedEntryIds.includes(sid))
    );

    for (const t of affected) {
      const sourceIds = t.sourceBalanceEntryIds || [];
      const breakdown = t.amountBreakdown || [t.amount];
      const keepIdx = sourceIds
        .map((sid, i) => (deletedEntryIds.includes(sid) ? -1 : i))
        .filter((i) => i !== -1);

      if (keepIdx.length === 0) {
        await db.transactions.delete(t.id);
        continue;
      }

      const newBreakdown = keepIdx.map((i) => breakdown[i]);
      const newSourceIds = keepIdx.map((i) => sourceIds[i]);
      await db.transactions.update(t.id, {
        amount: newBreakdown.reduce((s, v) => s + Number(v), 0),
        amountBreakdown: newBreakdown,
        sourceBalanceEntryIds: newSourceIds,
      });
    }
  });

  const removeBalanceEntry = atomic("removeBalanceEntry", async (entryId) => {
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
    // side survives. Same logic now applies to a Convert entry that has a
    // linked funding-source debit (addConvertEntry's sourceAccountId) -
    // both share transferGroupId the same way a plain transfer's two legs
    // do, so this fires for either type and removes both legs together,
    // regardless of which one the user deletes from.
    if ((entry.type === "transfer" || entry.type === "convert") && entry.transferGroupId) {
      const pairIds = allEntries
        .filter((e) => e.transferGroupId === entry.transferGroupId)
        .map((e) => e.id);
      await db.balanceEntries.bulkDelete(pairIds);
      await cascadeRemoveFeeContributions(pairIds);
      return;
    }

    await db.balanceEntries.delete(entryId);
    await cascadeRemoveFeeContributions([entryId]);
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

    const id = await db.accountTypes.add({ name: trimmed, createdAt: new Date() });
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
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    });
    setYears([]);
    setTravels([]);
    setAccounts([]);
    setBalanceEntries([]);
    setAccountTypes([]);
    setSyncStatus(null);
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
    a.download = `expenses_export_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Some mobile browsers start the download asynchronously; revoking at once can cancel it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // -------------------------
  // Import Expenses - split into parse (no DB writes) and commit, so
  // callers can show a preview/confirmation before anything is written.
  // -------------------------
  const readAllTables = inTx(async () => {
    const arrays = await Promise.all(IMPORT_TABLES.map((name) => db[name].toArray()));
    return Object.fromEntries(IMPORT_TABLES.map((name, i) => [name, arrays[i]]));
  });

  const parseImportFile = withErrorHandling("parseImportFile", async (file) => {
    if (file.size > MAX_IMPORT_BYTES) {
      throw new Error("That file is too large to import (max 25 MB).");
    }

    const text = await file.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }

    // Throws a descriptive error if the shape doesn't match what this app
    // can map - caught by the caller before anything is shown or written.
    const existing = await readAllTables();
    const validated = validateImportShape(parsed, existing);
    // Exports from before UUID ids would collide with ids from other devices.
    const data = needsRekey(validated) ? rekeyTables(validated) : validated;
    const counts = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));

    return { data, counts, plan: planImport(existing, data) };
  });

  // Re-plans against the data as it is at commit time, so edits made while
  // the preview was open are kept rather than overwritten.
  const commitImport = withErrorHandling("commitImport", async (plan, resolutions = {}) => {
    const summary = await db.transaction("rw", db.tables, async () => {
      const current = planImport(await readAllTables(), plan.incoming);
      if (!sameConflicts(current, plan)) {
        throw new Error("Your data changed since the preview - please import the file again.");
      }

      const { tables, mergedTransactionIds } = applyImportResolutions(current, resolutions);
      for (const name of IMPORT_TABLES) {
        await db[name].clear();
        await db[name].bulkPut(tables[name]);
      }
      for (const id of mergedTransactionIds) await syncShadowExpenseEntry(id);

      return current.summary;
    });

    await Promise.all([reloadHierarchy(), reloadAssets()]);
    return { summary };
  });

  // -------------------------
  // Google Drive sync: prepareSync downloads and merges without writing;
  // planSync applies record choices; commitSync writes locally, then uploads.
  // -------------------------
  const forgetTokenOnAuthError = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof drive.DriveAuthError) clearAccessToken();
      throw err;
    }
  };

  const prepareSync = withErrorHandling("prepareSync", async () => {
    const accessToken = await getAccessToken();
    return forgetTokenOnAuthError(async () => {
      const [state, local, file] = await Promise.all([
        db.syncState.get(SYNC_STATE_KEY),
        readAllTables(),
        drive.findSyncFile(accessToken),
      ]);
      const remote = file
        ? validateImportShape(parseSnapshot(await drive.downloadFile(accessToken, file.id)).tables, local)
        : {};
      // Base hashes are only meaningful against the Drive file they were recorded for.
      const base = file && state?.fileId === file.id ? state.base : {};

      return {
        fileId: file?.id ?? null,
        remoteVersion: file?.version ?? null,
        localHash: hashRecord(hashTables(local)),
        remoteHash: file ? hashRecord(hashTables(remote)) : null,
        merge: mergeSnapshots({ base, local, remote }),
      };
    });
  });

  const planSync = (prepared, recordResolutions = {}) => {
    const sides = applyRecordResolutions(prepared.merge, recordResolutions);
    return planImport(sides.localSide, sides.remoteSide);
  };

  // Writes locally only if the merged result differs from this device, and
  // uploads only if it differs from Drive, so a no-op sync touches nothing.
  const commitSync = withErrorHandling("commitSync", async (prepared, recordResolutions = {}, planResolutions = {}) => {
    const accessToken = await getAccessToken();
    const plan = planSync(prepared, recordResolutions);
    const { tables } = applyImportResolutions(plan, planResolutions);
    const finalHashes = hashTables(tables);
    const finalHash = hashRecord(finalHashes);

    if (finalHash !== prepared.localHash) {
      const withShadows = { ...tables, balanceEntries: [...tables.balanceEntries, ...buildShadowEntries(tables)] };
      await db.transaction("rw", db.tables, async () => {
        if (hashRecord(hashTables(await readAllTables())) !== prepared.localHash) {
          throw new SyncRetryError("Data on this device changed during sync. Please sync again.");
        }
        for (const name of IMPORT_TABLES) {
          await db[name].clear();
          await db[name].bulkPut(withShadows[name]);
        }
      });
      await Promise.all([reloadHierarchy(), reloadAssets()]);
    }

    await forgetTokenOnAuthError(async () => {
      let fileId = prepared.fileId;
      if (finalHash !== prepared.remoteHash) {
        if (fileId && (await drive.getFileVersion(accessToken, fileId)) !== prepared.remoteVersion) {
          throw new SyncRetryError("Google Drive was updated from another device during this sync. Please sync again.");
        }
        const content = JSON.stringify(buildSnapshot(tables));
        const saved = fileId
          ? await drive.updateSyncFile(accessToken, fileId, content)
          : await drive.createSyncFile(accessToken, content);
        fileId = saved.id;
      }

      const lastSyncedAt = new Date();
      await db.syncState.put({ key: SYNC_STATE_KEY, fileId, base: finalHashes, lastSyncedAt });
      setSyncStatus({ lastSyncedAt });
    });

    return { summary: plan.summary };
  });

  // True when this device has changes the Drive copy hasn't seen yet.
  const hasPendingChanges = async () => {
    const [state, local] = await Promise.all([db.syncState.get(SYNC_STATE_KEY), readAllTables()]);
    const localHashes = hashTables(local);
    if (!state?.base) return Object.values(localHashes).some((rows) => Object.keys(rows).length > 0);
    return hashRecord(localHashes) !== hashRecord(state.base);
  };

  // Keeps the sync base so deletions still propagate after reconnecting.
  const disconnectSync = withErrorHandling("disconnectSync", () => revokeAccess());

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
    const id = await db.buckets.add({ name, createdAt: new Date() });
    bumpDataVersion();
    return id;
  });

  const renameBucket = withErrorHandling("renameBucket", async (id, name) => {
    await db.buckets.update(id, { name: name.trim() });
    bumpDataVersion();
  });

  // Empty icon removes it (Dexie drops keys set to undefined).
  const setBucketIcon = withErrorHandling("setBucketIcon", async (id, icon) => {
    await db.buckets.update(id, { icon: icon?.trim() || undefined });
    bumpDataVersion();
  });

  const removeBucket = withErrorHandling("removeBucket", async (id) => {
    await db.bucketAssignments.where({ bucketId: id }).delete();
    await db.buckets.delete(id);
    bumpDataVersion();
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
      await db.bucketAssignments.add({ bucketId, category, createdAt: new Date() });
    }
    bumpDataVersion();
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
      bumpDataVersion();
    }
  });

  const value = {
    isLoaded,
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
    editTransaction,
    saveDayTransactions,

    addTravel,
    updateTravel,
    removeTravel,

    getYearId,
    getMonthId,
    clearDB,
    exportExpenses,
    parseImportFile,
    commitImport,

    syncStatus,
    dataVersion,
    hasPendingChanges,
    prepareSync,
    planSync,
    commitSync,
    disconnectSync,

    addBucket,
    renameBucket,
    setBucketIcon,
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
