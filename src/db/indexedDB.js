import Dexie from "dexie";

// --------------------
// Dexie setup
// --------------------
export const db = new Dexie("ExpensesDB");

// Year → Month → Day → Transaction hierarchy
db.version(3).stores({
  years: "++id, year",
  months: "++id, yearId, name, &[yearId+name]",
  days: "++id, yearId, monthId, day, &[yearId+monthId+day]",
  transactions:
    "++id, yearId, monthId, dayId, category, &[yearId+monthId+dayId+category]",
  travels: "++id, name, startDate, endDate, description",
  travel_transactions:
    "++id, travelId, yearId, monthId, dayId, category, &[travelId+yearId+monthId+dayId+category]",
  buckets: "++id, name",
  bucketAssignments: "++id, bucketId, category",
});

// --------------------
// Year helpers
// --------------------
export const addYear = async (yearNumber) => {
  const existing = await db.years.where({ year: yearNumber }).first();
  if (existing) return existing.id;
  return await db.years.add({ year: yearNumber });
};

export const getAllYears = async () => db.years.toArray();

export const removeYear = async (yearId) => {
  const months = await db.months.where({ yearId }).toArray();
  for (const month of months) {
    await removeMonth(month.id);
  }
  await db.years.delete(yearId);
};

// --------------------
// Month helpers
// --------------------
export const addMonth = async (yearId, monthName) => {
  const existing = await db.months.where("[yearId+name]").equals([yearId, monthName]).first();
  if (existing) return existing.id;
  return await db.months.add({ yearId, name: monthName });
};

export const getMonthsByYear = async (yearId) => {
  return await db.months.where({ yearId }).sortBy("name");
};

export const removeMonth = async (monthId) => {
  const days = await db.days.where({ monthId }).toArray();
  for (const day of days) {
    await removeDay(day.id);
  }
  await db.months.delete(monthId);
};

// --------------------
// Day helpers
// --------------------
export const addDay = async (yearId, monthId, dayNumber) => {
  const existing = await db.days.where("[yearId+monthId+day]").equals([yearId, monthId, dayNumber]).first();
  if (existing) return existing.id;
  return await db.days.add({ yearId, monthId, day: dayNumber });
};

export const getDaysByMonth = async (monthId) => {
  return await db.days.where({ monthId }).sortBy("day");
};

export const removeDay = async (dayId) => {
  await db.transactions.where({ dayId }).delete();
  await db.days.delete(dayId);
};

// --------------------
// Transaction helpers
// --------------------
export const addTransaction = async (yearId, monthId, dayId, transaction) => {
  const existing = await db.transactions
    .where("[yearId+monthId+dayId+category]")
    .equals([yearId, monthId, dayId, transaction.category])
    .first();
  if (existing) return existing.id;

  return await db.transactions.add({
    ...transaction,
    yearId,
    monthId,
    dayId,
  });
};

export const getTransactionsByDay = async (dayId) => {
  return await db.transactions.where({ dayId }).toArray();
};

export const updateTransaction = async (transactionId, updatedFields) => {
  await db.transactions.update(transactionId, updatedFields);
};

export const removeTransaction = async (transactionId) => {
  await db.transactions.delete(transactionId);
};

// --------------------
// Utility: fetch full hierarchy
// --------------------
export const getAllExpenses = async () => {
  const years = await db.years.toArray();
  const months = await db.months.toArray();
  const days = await db.days.toArray();
  const transactions = await db.transactions.toArray();

  return years.map((y) => ({
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
};

// --------------------
// Utility: clear entire DB
// --------------------
export const clearDB = async () => {
  await db.transactions.clear();
  await db.days.clear();
  await db.months.clear();
  await db.years.clear();
};
