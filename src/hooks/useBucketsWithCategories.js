import { useState, useEffect } from "react";
import { useExpenseContext } from "../context/ExpenseContext";

// Loads buckets (with their assigned categories) on mount. Was a duplicated
// useEffect + useState pair in SummaryPage; TravelDetailPage's bucket
// drill-down needs the exact same data.
export function useBucketsWithCategories() {
  const { getBucketsWithCategories } = useExpenseContext();
  const [buckets, setBuckets] = useState([]);

  useEffect(() => {
    getBucketsWithCategories().then((b) => setBuckets(b || []));
  }, []);

  return buckets;
}
