import { useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";

export default function ClearDBTab() {
  const { clearDB } = useExpenseContext();
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (!confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;
    setLoading(true);
    await clearDB();
    setLoading(false);
    alert("All data cleared!");
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Clear Database</h2>
      <p className="text-gray-600">
        This will delete all years, months, days, transactions, buckets, and bucket assignments.
      </p>
      <button
        onClick={handleClear}
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl w-48"
      >
        {loading ? "Clearing…" : "Clear Database"}
      </button>
    </div>
  );
}
