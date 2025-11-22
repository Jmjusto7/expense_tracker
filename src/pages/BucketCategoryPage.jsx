import { useState, useMemo } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import MonthlySpendChart from "../components/MonthlySpendChart";

const BucketCategoryPage = () => {
  const { years } = useExpenseContext();

  // Bucket categories state
  const [buckets, setBuckets] = useState([]); // { name: string, categories: [] }
  const [newBucketName, setNewBucketName] = useState("");

  // Flatten all transactions
  const allTransactions = useMemo(() => {
    return years
      .flatMap(y => y.months ?? [])
      .flatMap(m => m.days ?? [])
      .flatMap(d => d.transactions ?? []);
  }, [years]);

  // All unique categories
  const allCategories = useMemo(() => {
    const cats = new Set(allTransactions.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [allTransactions]);

  // Add new bucket
  const addBucket = () => {
    if (newBucketName.trim() === "") return;
    setBuckets([...buckets, { name: newBucketName.trim(), categories: [] }]);
    setNewBucketName("");
  };

  // Toggle category assignment in bucket
  const toggleCategoryInBucket = (bucketIndex, category) => {
    setBuckets(prev => {
      const updated = [...prev];
      const catIndex = updated[bucketIndex].categories.indexOf(category);
      if (catIndex >= 0) {
        updated[bucketIndex].categories.splice(catIndex, 1);
      } else {
        updated[bucketIndex].categories.push(category);
      }
      return updated;
    });
  };

  // Compute totals per bucket
  const bucketTotals = useMemo(() => {
    const map = {};

    buckets.forEach(bucket => {
      map[bucket.name] = 0;
    });

    allTransactions.forEach(t => {
      buckets.forEach(bucket => {
        if (bucket.categories.includes(t.category)) {
          map[bucket.name] += Number(t.amount ?? 0);
        }
      });
    });

    return Object.entries(map)
      .map(([bucket, total]) => ({ bucket, total }))
      .filter(b => b.total > 0);
  }, [allTransactions, buckets]);

  // Convert bucketTotals to monthly data for chart
  const monthlyTotals = useMemo(() => {
    const map = {};
    allTransactions.forEach(t => {
      const yearObj = years.find(y => y.id === t.yearId);
      const monthObj = yearObj?.months?.find(m => m.id === t.monthId);
      if (!monthObj || !yearObj) return;

      const monthKey = `${monthObj.name} ${yearObj.year}`;
      buckets.forEach(bucket => {
        if (bucket.categories.includes(t.category)) {
          if (!map[monthKey]) map[monthKey] = 0;
          map[monthKey] += Number(t.amount ?? 0);
        }
      });
    });

    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [allTransactions, buckets, years]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Bucket Categories</h2>

      {/* Add Bucket */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newBucketName}
          onChange={e => setNewBucketName(e.target.value)}
          placeholder="New bucket name"
          className="border px-3 py-2 rounded-lg flex-1"
        />
        <button
          onClick={addBucket}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          Add Bucket
        </button>
      </div>

      {/* Assign categories to buckets */}
      <div className="flex flex-col gap-4 mb-6">
        {buckets.map((bucket, idx) => (
          <div key={idx} className="border p-4 rounded-lg">
            <h3 className="font-semibold mb-2">{bucket.name}</h3>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(cat => (
                <label key={cat} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={bucket.categories.includes(cat)}
                    onChange={() => toggleCategoryInBucket(idx, cat)}
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Show chart */}
      {monthlyTotals.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Monthly Spending by Buckets</h3>
          <MonthlySpendChart data={monthlyTotals} />
        </div>
      ) : (
        <p className="text-gray-500">No expenses in the selected buckets yet.</p>
      )}
    </div>
  );
};

export default BucketCategoryPage;
