// src/context/ExpenseContext.jsx
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { db } from "./db";
import { normalizeTravelId } from "../utils/travelHelpers";
import { validateImportShape } from "../utils/importValidation";
import {
  findDuplicateGroups,
  buildDayLookup,
  transactionFingerprint,
  bucketFingerprint,
  bucketAssignmentFingerprint,
} from "../utils/importDedup";

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
    await db.transactions.where({ dayId }).delete();
    await db.days.delete(dayId);
    await reloadHierarchy();
  });

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
      });

      await reloadHierarchy();
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
      await reloadHierarchy();
    }
  );

  const removeTransaction = withErrorHandling("removeTransaction", async (transactionId) => {
    await db.transactions.delete(transactionId);
    await reloadHierarchy();
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
    setYears([]);
    setTravels([]);
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
    const { years, months, days, transactions, travels, buckets, bucketAssignments } =
      validateImportShape(parsed);

    const data = { years, months, days, transactions, travels, buckets, bucketAssignments };
    const counts = {
      years: years.length,
      months: months.length,
      days: days.length,
      transactions: transactions.length,
      travels: travels.length,
      buckets: buckets.length,
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
    const [allYears, allMonths, allDays, allTx, allBuckets, allAssignments] = await Promise.all([
      db.years.toArray(),
      db.months.toArray(),
      db.days.toArray(),
      db.transactions.toArray(),
      db.buckets.toArray(),
      db.bucketAssignments.toArray(),
    ]);

    // 1) Buckets duplicated by name - keep highest id, remap any
    // assignments pointing at the removed (lower-id, "older") duplicates
    // over to the retained bucket.
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

    // 2) Bucket assignments duplicated by (bucket, category) - remapping
    // above can itself create fresh duplicates (two old buckets both had
    // "Food" assigned, both now point at the same retained bucket).
    const assignmentsAfterRemap = await db.bucketAssignments.toArray();
    const assignmentDupes = findDuplicateGroups(assignmentsAfterRemap, bucketAssignmentFingerprint);
    const removedAssignmentIds = assignmentDupes.flatMap(({ remove }) => remove.map((a) => a.id));
    if (removedAssignmentIds.length > 0) {
      await db.bucketAssignments.bulkDelete(removedAssignmentIds);
    }

    // 3) Transactions duplicated by semantic fingerprint (year/month/day/
    // category/amount/comments/breakdown/travel reference).
    const dayLookup = buildDayLookup(allYears, allMonths, allDays);
    const txDupes = findDuplicateGroups(allTx, (t) => transactionFingerprint(t, dayLookup));
    const removedTxIds = txDupes.flatMap(({ remove }) => remove.map((t) => t.id));
    if (removedTxIds.length > 0) {
      await db.transactions.bulkDelete(removedTxIds);
    }

    return {
      bucketsRemoved: removedBucketIds.length,
      assignmentsRemoved: removedAssignmentIds.length,
      transactionsRemoved: removedTxIds.length,
    };
  };

  const commitImport = withErrorHandling("commitImport", async (data) => {
    const { years, months, days, transactions, travels, buckets, bucketAssignments } = data;

    await db.travels.bulkPut(travels);
    await db.buckets.bulkPut(buckets);
    await db.bucketAssignments.bulkPut(bucketAssignments);
    await db.years.bulkPut(years);
    await db.months.bulkPut(months);
    await db.days.bulkPut(days);
    await db.transactions.bulkPut(transactions);

    const cleanup = await cleanupDuplicatesAfterImport();

    await reloadHierarchy();

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
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export const useExpenseContext = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenseContext must be used within an ExpenseProvider");
  return ctx;
};
