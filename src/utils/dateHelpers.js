// src/utils/dateHelpers.js

export const ALL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Index (0-11) of a month name, e.g. "March" -> 2. Used for chronological sorting.
export const monthIndexOf = (monthName) => ALL_MONTHS.indexOf(monthName);

// Safe display formatter for dates that may be a Date, an ISO string, or missing.
export const formatDate = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
};

// "MMM YY" formatter used by the monthly spend chart, e.g. "Jan 26"
export const formatMonthYear = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("default", { month: "short", year: "2-digit" });
};

// Picks a sensible default date for the Add Transaction date picker, so the
// common case (logging something from today) doesn't require touching the
// calendar at all. Only defaults when the modal is open on the real current
// month - browsing a past/future month leaves the picker empty as before,
// since "today" isn't a meaningful default there.
// existingDays: array of day numbers already used in this month (disabled
// in the calendar) - if today is already taken, falls back to the nearest
// selectable day.
export const computeDefaultTransactionDate = (year, monthIndex, existingDays = []) => {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  if (!isCurrentMonth) return null;

  const monthEnd = new Date(year, monthIndex + 1, 0).getDate();
  const todayDay = today.getDate();

  if (!existingDays.includes(todayDay)) return new Date(year, monthIndex, todayDay);

  for (let d = todayDay + 1; d <= monthEnd; d++) {
    if (!existingDays.includes(d)) return new Date(year, monthIndex, d);
  }
  for (let d = todayDay - 1; d >= 1; d--) {
    if (!existingDays.includes(d)) return new Date(year, monthIndex, d);
  }
  return null; // every day this month is already used
};
