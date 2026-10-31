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

const dayTs = (d) => {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

// Ongoing/upcoming trips (soonest first) are pinned; past trips are grouped
// by the year they started, newest year and newest trip first.
export function groupTravelsByYear(travels, today = new Date()) {
  const todayTs = dayTs(today);
  const start = (t) => new Date(t.startDate).getTime() || 0;
  const isCurrent = (t) => t.endDate && dayTs(t.endDate) >= todayTs;

  const pinned = travels.filter(isCurrent).sort((a, b) => start(a) - start(b));
  const byYear = new Map();
  for (const travel of travels.filter((t) => !isCurrent(t)).sort((a, b) => start(b) - start(a))) {
    const year = travel.startDate ? new Date(travel.startDate).getFullYear() : "Undated";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(travel);
  }
  return { pinned, years: [...byYear.entries()].map(([year, items]) => ({ year, travels: items })) };
}

// The trip an expense on `date` most likely belongs to: one whose dates
// contain it (the shortest trip wins when trips overlap).
export function findTravelForDate(travels, date) {
  if (!date) return null;
  const ts = dayTs(date);
  const matches = travels.filter(
    (t) => t.startDate && t.endDate && dayTs(t.startDate) <= ts && ts <= dayTs(t.endDate)
  );
  matches.sort((a, b) => dayTs(a.endDate) - dayTs(a.startDate) - (dayTs(b.endDate) - dayTs(b.startDate)));
  return matches[0] ?? null;
}
