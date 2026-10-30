// src/utils/travelHelpers.js

// Sentinel id for the synthetic "Travel" filter pill/chip - it isn't a real
// bucket in the DB. Selecting it means "any transaction tagged with a
// travel", cutting across whatever bucket its category actually belongs to.
// Shared across SummaryPage, FilterContext, and FilterBar so they all agree
// on what this value means.
export const TRAVEL_FILTER_ID = "__travel__";

// Normalize a travelId to a string (or null) no matter where it came from -
// a <select> value is always a string, route params (useParams) are always
// strings too, and DB ids are Dexie Cloud @id strings (e.g. "trv7f3a...")
// rather than numbers. Deliberately NOT Number()-coerced anymore: doing so
// on a Dexie Cloud id silently returns NaN -> null, which would drop every
// travel tag the moment addTransaction/updateTransaction/removeTravel ran.
export const normalizeTravelId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
};

// Find a travel by id regardless of incidental whitespace/type differences
// in how `id` arrives.
export const findTravelById = (travels, id) => {
  const target = normalizeTravelId(id);
  if (target === null) return null;
  return travels?.find((t) => String(t.id) === target) || null;
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
