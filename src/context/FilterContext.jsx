// src/context/FilterContext.jsx
import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { useExpenseContext } from "./ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import { transactionMatchesFilter, transactionMatchesDate } from "../utils/transactionFilter";

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const { allTransactions } = useExpenseContext();
  const buckets = useBucketsWithCategories();

  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [selectedBucketIds, setSelectedBucketIds] = useState([]);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState([]);

  const hasActiveFilters = Boolean(
    fromDate || toDate || selectedBucketIds.length > 0 || selectedCategoryFilters.length > 0
  );

  const clearFilters = () => {
    setFromDate(null);
    setToDate(null);
    setSelectedBucketIds([]);
    setSelectedCategoryFilters([]);
  };

  const clearDateRange = () => {
    setFromDate(null);
    setToDate(null);
  };

  const removeBucketFilter = (id) =>
    setSelectedBucketIds((prev) => prev.filter((x) => x !== id));

  const removeCategoryFilter = (cat) =>
    setSelectedCategoryFilters((prev) => prev.filter((x) => x !== cat));

  const filterState = { fromDate, toDate, selectedBucketIds, selectedCategoryFilters, buckets };

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

  // Self-maintain validity: if a selected category no longer appears within
  // the current date range (e.g. the range changed, or the category's
  // transactions were deleted), drop it rather than silently filtering to
  // nothing. Lives here (not in SummaryPage) so it holds regardless of
  // which page changed the underlying data.
  useEffect(() => {
    const available = new Set(
      allTransactions.filter((t) => matchesDate(t)).map((t) => t.category)
    );
    setSelectedCategoryFilters((prev) => prev.filter((cat) => available.has(cat)));
  }, [allTransactions, matchesDate]);

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
    hasActiveFilters,
    clearFilters,
    clearDateRange,
    removeBucketFilter,
    removeCategoryFilter,
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
