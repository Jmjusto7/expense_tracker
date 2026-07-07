// src/utils/travelHelpers.js

// Sentinel id for the synthetic "Travel" filter pill/chip - it isn't a real
// bucket in the DB. Selecting it means "any transaction tagged with a
// travel", cutting across whatever bucket its category actually belongs to.
// Shared across SummaryPage, FilterContext, and FilterBar so they all agree
// on what this value means.
export const TRAVEL_FILTER_ID = "__travel__";

// Normalize a travelId to a Number (or null) no matter where it came from -
// a <select> value is always a string, DB ids are always numbers, and route
// params (useParams) are always strings too.
export const normalizeTravelId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

// Find a travel by id regardless of whether `id` arrives as a string or number.
export const findTravelById = (travels, id) => {
  const target = normalizeTravelId(id);
  if (target === null) return null;
  return travels?.find((t) => t.id === target) || null;
};

// All transactions tagged with a given travel, regardless of travelId's
// original type.
export const filterTransactionsByTravel = (transactions, travelId) => {
  const target = normalizeTravelId(travelId);
  if (target === null) return [];
  return transactions.filter((t) => normalizeTravelId(t.travelId) === target);
};

export const sumAmounts = (transactions) =>
  transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
