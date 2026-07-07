// src/utils/transactionFilter.js
import { monthIndexOf } from "./dateHelpers";
import { classifyTransaction, matchesBucketAndCategoryFilter } from "./transactionClassification";
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
// Uses native classification: travel-tagged transactions belong to Travel
// bucket exclusively, not their category's normal bucket.
// 
// Supports 3-level Travel drill-down: Travel -> Bucket -> Category
// When travelDrillBucketId is set and Travel is selected, filters travel
// transactions by their category's bucket (ignoring travel override).
export function transactionMatchesBucketAndCategory(
  t,
  { selectedBucketIds, selectedCategoryFilters, buckets, travelDrillBucketId }
) {
  const isTravelSelected = selectedBucketIds.includes(TRAVEL_FILTER_ID);

  // Travel -> Bucket -> Category (3-level drill-down)
  if (isTravelSelected && selectedBucketIds.length === 1 && travelDrillBucketId) {
    // Must be a travel-tagged transaction
    if (t.travelId == null) return false;

    // Classify by category's bucket (ignore travel override)
    const classified = classifyTransaction(t, buckets, { ignoreTravelOverride: true });

    // Must match the drill-down bucket
    if (classified.effectiveBucketId !== travelDrillBucketId) return false;

    // Apply category filter if any
    if (selectedCategoryFilters.length > 0) {
      return selectedCategoryFilters.includes(classified.category);
    }

    return true;
  }

  // Standard classification flow
  const classified = classifyTransaction(t, buckets);

  return matchesBucketAndCategoryFilter(classified, {
    selectedBucketIds,
    selectedCategoryFilters,
  });
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
