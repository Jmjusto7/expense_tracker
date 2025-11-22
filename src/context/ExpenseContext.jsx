// src/context/ExpenseContext.jsx
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import Dexie from "dexie";

// ---------------------------
// IndexedDB setup
// ---------------------------
const db = new Dexie("ExpensesDB");

db.version(2).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",
  transactions:
    "++id, yearId, monthId, dayId, category, &[yearId+monthId+dayId+category]",
  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",
});

const ExpenseContext = createContext();

export function ExpenseProvider({ children }) {
  const [years, setYears] = useState([]);

  // ---------------------------
  // Load full hierarchy from DB
  // ---------------------------
  const reloadHierarchy = async () => {
    const allYears = await db.years.toArray();
    const allMonths = await db.months.toArray();
    const allDays = await db.days.toArray();
    const allTransactions = await db.transactions.toArray();

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
              transactions: allTransactions.filter(
                (t) =>
                  t.dayId === d.id &&
                  t.monthId === m.id &&
                  t.yearId === y.id
              ),
            })),
        })),
    }));

    setYears(structured);
  };

  // Load once on mount
  useEffect(() => {
    reloadHierarchy();
  }, []);

  // ---------------------------
  // Year operations
  // ---------------------------
  const addYear = async (yearNumber) => {
    const existing = await db.years.where({ year: yearNumber }).first();
    if (existing) return existing.id;

    const yearId = await db.years.add({ year: yearNumber });
    await reloadHierarchy();
    return yearId;
  };

  const removeYear = async (yearId) => {
    const monthsToDelete = await db.months.where({ yearId }).toArray();
    for (const m of monthsToDelete) await removeMonth(m.id);
    await db.years.delete(yearId);
    await reloadHierarchy();
  };

  // ---------------------------
  // Month operations
  // ---------------------------
  const addMonth = async (yearId, name) => {
    const existing = await db.months
      .where("[yearId+name]")
      .equals([yearId, name])
      .first();
    if (existing) return existing.id;

    const monthId = await db.months.add({ yearId, name });
    await reloadHierarchy();
    return monthId;
  };

  const removeMonth = async (monthId) => {
    const daysToDelete = await db.days.where({ monthId }).toArray();
    for (const d of daysToDelete) await removeDay(d.id);
    await db.months.delete(monthId);
    await reloadHierarchy();
  };

  // ---------------------------
  // Day operations
  // ---------------------------
  const addDay = async (yearId, monthId, dayNumber) => {
    const existing = await db.days
      .where("[yearId+monthId+day]")
      .equals([yearId, monthId, dayNumber])
      .first();
    if (existing) return existing.id;

    const dayId = await db.days.add({ yearId, monthId, day: dayNumber });
    await reloadHierarchy();
    return dayId;
  };

  const removeDay = async (dayId) => {
    await db.transactions.where({ dayId }).delete();
    await db.days.delete(dayId);
    await reloadHierarchy();
  };

  // ---------------------------
  // Transaction operations
  // ---------------------------
  const addTransaction = async (yearId, monthId, dayId, transaction) => {
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
    });
    await reloadHierarchy();
    return id;
  };

  const updateTransaction = async (transactionId, updatedFields) => {
    await db.transactions.update(transactionId, updatedFields);
    await reloadHierarchy();
  };

  const removeTransaction = async (transactionId) => {
    await db.transactions.delete(transactionId);
    await reloadHierarchy();
  };

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

  const clearDB = async () => {
    await db.transactions.clear();
    await db.days.clear();
    await db.months.clear();
    await db.years.clear();
    setYears([]);
  };

  // ---------------------------
  // Bucket operations
  // ---------------------------
  const addBucket = async (name) => {
    return await db.buckets.add({ name });
  };

  const removeBucket = async (id) => {
    await db.bucketAssignments.where({ bucketId: id }).delete();
    await db.buckets.delete(id);
  };

  const assignToBucket = async (bucketId, category) => {
    const assignments = await db.bucketAssignments
      .where({ category })
      .toArray();

    const alreadyAssignedToThisBucket = assignments.some(
      (a) => a.bucketId === bucketId
    );

    if (alreadyAssignedToThisBucket) {
      // If already assigned to this bucket, remove it (uncheck)
      await db.bucketAssignments
        .where({ bucketId, category })
        .delete();
    } else {
      // Remove from any other bucket and assign to this one
      await db.bucketAssignments.where({ category }).delete();
      await db.bucketAssignments.add({ bucketId, category });
    }
  };


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
      console.error("Bucket load error:", err);
      return [];
    }
  };

  // Add this helper to get all unique categories
  const categories = useMemo(() => {
    const allTransactions = years
      .flatMap((y) => y.months ?? [])
      .flatMap((m) => m.days ?? [])
      .flatMap((d) => d.transactions ?? []);
    const cats = new Set(allTransactions.map((t) => t.category).filter(Boolean));
    return Array.from(cats).sort((a, b) => a.localeCompare(b)); // alphabetically sorted
  }, [years]);

  const cleanBucketAssignments = async () => {
    try {
      const assignments = await db.bucketAssignments.toArray();
      // Get all transactions directly from DB
      const allTransactions = await db.transactions.toArray();

      // Extract all unique categories
      const existingCategories = new Set(
        allTransactions.map((t) => t.category).filter(Boolean)
      );

      const invalidAssignments = assignments.filter(
        (a) => !existingCategories.has(a.category)
      );

      if (invalidAssignments.length > 0) {
        await db.bucketAssignments.bulkDelete(
          invalidAssignments.map((a) => a.id)
        );
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  };

  // ---------------------------
  // Export / Import
  // ---------------------------
  const exportExpenses = async () => {
    const data = await db.years.toArray();
    const months = await db.months.toArray();
    const days = await db.days.toArray();
    const transactions = await db.transactions.toArray();

    const structured = data.map((y) => ({
      ...y,
      months: months
        .filter((m) => m.yearId === y.id)
        .map((m) => ({
          ...m,
          days: days
            .filter((d) => d.monthId === m.id && d.yearId === y.id)
            .map((d) => ({
              ...d,
              transactions: transactions.filter(
                (t) =>
                  t.dayId === d.id &&
                  t.monthId === m.id &&
                  t.yearId === y.id
              ),
            })),
        })),
    }));

    const blob = new Blob([JSON.stringify(structured, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_export_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const importExpenses = async (file, replace = false) => {
    const text = await file.text();
    let importedData;

    try {
      importedData = JSON.parse(text);
    } catch {
      alert("Invalid JSON file.");
      return;
    }

    if (replace) await clearDB();

    for (const year of importedData) {
      const yearId = await addYear(year.year);

      for (const month of year.months || []) {
        const monthId = await addMonth(yearId, month.name);

        for (const day of month.days || []) {
          const dayId = await addDay(yearId, monthId, day.day);

          for (const tx of day.transactions || []) {
            const { id, ...txData } = tx;
            await addTransaction(yearId, monthId, dayId, txData);
          }
        }
      }
    }

    alert("Import completed!");
  };

  const value = {
    years,
    addYear,
    removeYear,
    addMonth,
    removeMonth,
    addDay,
    removeDay,
    addTransaction,
    updateTransaction,
    removeTransaction,
    getYearId,
    getMonthId,
    clearDB,
    exportExpenses,
    importExpenses,
    categories,
    addBucket,
    removeBucket,
    assignToBucket,
    cleanBucketAssignments,
    getBucketsWithCategories,
  };

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
}

export const useExpenseContext = () => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpenseContext must be used within an ExpenseProvider");
  return ctx;
};
