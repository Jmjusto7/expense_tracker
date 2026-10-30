import { useState, useEffect } from "react";
import { useExpenseContext } from "../context/ExpenseContext";

// Loads buckets (with their assigned categories) on mount. Was a duplicated
// useEffect + useState pair in SummaryPage; TravelDetailPage's bucket
// drill-down needs the exact same data.
export function useBucketsWithCategoriesState() {
  const { getBucketsWithCategories } = useExpenseContext();
  const [state, setState] = useState({ buckets: [], loaded: false });

  useEffect(() => {
    getBucketsWithCategories().then((b) => setState({ buckets: b || [], loaded: true }));
  }, []);

  return state;
}

export function useBucketsWithCategories() {
  return useBucketsWithCategoriesState().buckets;
}
