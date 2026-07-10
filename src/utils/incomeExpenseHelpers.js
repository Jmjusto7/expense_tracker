// src/utils/incomeExpenseHelpers.js
import { ALL_MONTHS } from "./dateHelpers";

// One row per calendar month that has ANY expense transaction or income
// entry, built from the full unfiltered history - Home and the Assets tab
// both need the whole picture now that filter-setting lives only on the
// Expenses tab (see the Home-simplification discussion).
export function buildMonthlyIncomeExpense(allTransactions, balanceEntries) {
  const map = {};

  allTransactions.forEach((t) => {
    if (!t.yearNumber || !t.monthName) return;
    const monthIndex = ALL_MONTHS.indexOf(t.monthName);
    const key = `${t.yearNumber}-${monthIndex}`;
    if (!map[key]) {
      map[key] = { date: new Date(t.yearNumber, monthIndex, 1), income: 0, expense: 0 };
    }
    map[key].expense += Number(t.amount ?? 0);
  });

  balanceEntries
    .filter((e) => e.type === "income")
    .forEach((e) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[key]) {
        map[key] = { date: new Date(d.getFullYear(), d.getMonth(), 1), income: 0, expense: 0 };
      }
      map[key].income += Number(e.amount || 0);
    });

  return Object.values(map)
    .map((row) => ({ ...row, net: row.income - row.expense }))
    .sort((a, b) => a.date - b.date);
}

// Sum of `net` for the 12 calendar months ending at (and including)
// `endDate`'s month - the building block for the Home page's trailing
// 12-month Gap Trend stat.
export function trailing12MonthGap(monthlyRows, endDate) {
  const endTs = new Date(endDate.getFullYear(), endDate.getMonth(), 1).getTime();
  const startTs = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1).getTime();

  return monthlyRows
    .filter((r) => r.date.getTime() >= startTs && r.date.getTime() <= endTs)
    .reduce((sum, r) => sum + r.net, 0);
}

// Finds the row for a specific calendar month, or null if that month has
// no data at all.
export function findMonthRow(monthlyRows, year, monthIndex) {
  return (
    monthlyRows.find(
      (r) => r.date.getFullYear() === year && r.date.getMonth() === monthIndex
    ) || null
  );
}
