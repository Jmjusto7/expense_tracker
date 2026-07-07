// src/context/FilterContext.jsx
import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useExpenseContext } from "./ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import { transactionMatchesFilter, transactionMatchesDate } from "../utils/transactionFilter";
import { classifyTransactions, getAvailableCategories } from "../utils/transactionClassification";
import { TRAVEL_FILTER_ID } from "../utils/travelHelpers";

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const { allTransactions } = useExpenseContext();
  const buckets = useBucketsWithCategories();

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [selectedBucketIds, setSelectedBucketIds] = useState([]);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState([]);
  // For Travel 3-level drill-down: Travel -> Bucket -> Category
  // When Travel is selected, this holds the bucket ID within Travel to filter by
  const [travelDrillBucketId, setTravelDrillBucketId] = useState(null);

  // Is Travel filter currently active?
  const isTravelSelected = selectedBucketIds.includes(TRAVEL_FILTER_ID);

  const hasActiveFilters = Boolean(
    fromDate || toDate || selectedBucketIds.length > 0 || selectedCategoryFilters.length > 0 || travelDrillBucketId
  );

  const clearFilters = () => {
    setFromDate(null);
    setToDate(null);
    setSelectedBucketIds([]);
    setSelectedCategoryFilters([]);
    setTravelDrillBucketId(null);
  };

  const clearDateRange = () => {
    setFromDate(null);
    setToDate(null);
  };

  const removeBucketFilter = (id) => {
    // If removing Travel filter, also clear the drill-down bucket
    if (id === TRAVEL_FILTER_ID) {
      setTravelDrillBucketId(null);
    }
    setSelectedBucketIds((prev) => prev.filter((x) => x !== id));
  };

  const removeCategoryFilter = (cat) =>
    setSelectedCategoryFilters((prev) => prev.filter((x) => x !== cat));

  const removeTravelDrillBucket = () => {
    setTravelDrillBucketId(null);
    setSelectedCategoryFilters([]);
  };

  const filterState = { fromDate, toDate, selectedBucketIds, selectedCategoryFilters, buckets, travelDrillBucketId };

  // Full match (date + bucket/travel + category) - what every page outside
  // SummaryPage should use.
  const matches = useMemo(() => {
    return (t) => transactionMatchesFilter(t, filterState);
  }, [fromDate, toDate, selectedBucketIds, selectedCategoryFilters, buckets]);

  // Date-only match - SummaryPage needs this stage in isolation to compute
  // available categories before bucket/category narrowing is applied.
  const matchesDate = useMemo(() => {
    return (t) => transactionMatchesDate(t, filterState);
  }, [fromDate, toDate]);

  // Classify time-filtered transactions for scope-aware category validity
  const classifiedTx = useMemo(() => {
    const timeFiltered = allTransactions.filter((t) => matchesDate(t));
    return classifyTransactions(timeFiltered, buckets);
  }, [allTransactions, matchesDate, buckets]);

  // Clear travelDrillBucketId when Travel is deselected
  useEffect(() => {
    if (!isTravelSelected && travelDrillBucketId) {
      setTravelDrillBucketId(null);
    }
  }, [isTravelSelected, travelDrillBucketId]);

  // Travel-scoped classified transactions (for Travel drill-down)
  // Re-classifies travel transactions by their category's bucket (ignoring travel override)
  const travelScopedClassifiedTx = useMemo(() => {
    const timeFiltered = allTransactions.filter((t) => matchesDate(t) && t.travelId != null);
    return classifyTransactions(timeFiltered, buckets, { ignoreTravelOverride: true });
  }, [allTransactions, matchesDate, buckets]);

  // Self-maintain validity: if a selected category no longer appears within
  // the current date range or selected bucket scope, drop it rather than
  // silently filtering to nothing. Uses classification for scope awareness.
  useEffect(() => {
    // For Travel -> Bucket -> Category, use travel-scoped transactions
    if (isTravelSelected && travelDrillBucketId) {
      const scopedToTravelBucket = travelScopedClassifiedTx.filter(
        (t) => t.effectiveBucketId === travelDrillBucketId
      );
      const available = new Set(scopedToTravelBucket.map((t) => t.category).filter(Boolean));
      setSelectedCategoryFilters((prev) => prev.filter((cat) => available.has(cat)));
      return;
    }

    const available = new Set(
      getAvailableCategories(classifiedTx, selectedBucketIds)
    );
    setSelectedCategoryFilters((prev) => prev.filter((cat) => available.has(cat)));
  }, [classifiedTx, selectedBucketIds, isTravelSelected, travelDrillBucketId, travelScopedClassifiedTx]);

  const value = {
    buckets,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    selectedBucketIds,
    setSelectedBucketIds,
    selectedCategoryFilters,
    setSelectedCategoryFilters,
    travelDrillBucketId,
    setTravelDrillBucketId,
    isTravelSelected,
    travelScopedClassifiedTx,
    hasActiveFilters,
    clearFilters,
    clearDateRange,
    removeBucketFilter,
    removeCategoryFilter,
    removeTravelDrillBucket,
    matches,
    matchesDate,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export const useFilter = () => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within a FilterProvider");
  return ctx;
};
