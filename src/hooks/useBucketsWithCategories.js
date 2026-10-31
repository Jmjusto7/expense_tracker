import { useState, useEffect } from "react";
import { useExpenseContext } from "../context/ExpenseContext";

// Loads buckets (with their assigned categories) on mount. Was a duplicated
// useEffect + useState pair in SummaryPage; TravelDetailPage's bucket
// drill-down needs the exact same data.
export function useBucketsWithCategoriesState() {
  const { getBucketsWithCategories, dataVersion } = useExpenseContext();
  const [state, setState] = useState({ buckets: [], loaded: false });

  useEffect(() => {
    let active = true;
    getBucketsWithCategories().then((b) => active && setState({ buckets: b || [], loaded: true }));
    return () => {
      active = false;
    };
  }, [dataVersion]);

  return state;
}

export function useBucketsWithCategories() {
  return useBucketsWithCategoriesState().buckets;
}
