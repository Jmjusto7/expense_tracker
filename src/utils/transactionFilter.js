// src/utils/transactionFilter.js
import { monthIndexOf } from "./dateHelpers";
import { TRAVEL_FILTER_ID } from "./travelHelpers";

// Date-range portion only. Split out because SummaryPage needs this stage
// alone (to compute available categories before bucket/category narrowing).
export function transactionMatchesDate(t, { fromDate, toDate }) {
  if (!t.yearNumber || !t.monthName) return false;

  const txDate = new Date(t.yearNumber, monthIndexOf(t.monthName), 1);

  if (fromDate && txDate < fromDate) return false;
  if (toDate && txDate > toDate) return false;

  return true;
}

// Bucket/Travel + category portion only, assuming date has already passed
// (or isn't being checked).
export function transactionMatchesBucketAndCategory(
  t,
  { selectedBucketIds, selectedCategoryFilters, buckets }
) {
  if (selectedBucketIds.length > 0) {
    const realBucketIds = selectedBucketIds.filter((id) => id !== TRAVEL_FILTER_ID);
    const includesTravel = selectedBucketIds.includes(TRAVEL_FILTER_ID);

    const allowedCats = buckets
      .filter((b) => realBucketIds.includes(b.id))
      .flatMap((b) => b.categories);

    const inBucket = allowedCats.includes(t.category);
    const isTravelTagged = includesTravel && t.travelId != null;

    if (!inBucket && !isTravelTagged) return false;
  }

  if (selectedCategoryFilters.length > 0 && !selectedCategoryFilters.includes(t.category)) {
    return false;
  }

  return true;
}

// Full filter: date range + bucket/Travel + category. This is what every
// page outside SummaryPage should use - one call, matches everything the
// active filter means.
export function transactionMatchesFilter(t, filterState) {
  return (
    transactionMatchesDate(t, filterState) &&
    transactionMatchesBucketAndCategory(t, filterState)
  );
}
