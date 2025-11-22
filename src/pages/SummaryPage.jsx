import ExpensePieChart from "../components/ExpensePieChart";
import MonthlySpendChart from "../components/MonthlySpendChart";
import { useNavigate } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useState, useMemo, useEffect } from "react";

const SummaryPage = () => {
  const navigate = useNavigate();
  const { years, exportExpenses, importExpenses, getBucketsWithCategories } =
    useExpenseContext();

  const [importing, setImporting] = useState(false);

  // -------------------------
  // Filters
  // -------------------------
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [useBuckets, setUseBuckets] = useState(true);

  // bucket data
  const [buckets, setBuckets] = useState([]);
  const [selectedBucketIds, setSelectedBucketIds] = useState([]);

  // category filters (Row 3)
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState([]);

  useEffect(() => {
    getBucketsWithCategories().then((b) => setBuckets(b || []));
  }, []);

  // -------------------------
  // Flatten all transactions
  // -------------------------
  const allTransactions = useMemo(() => {
    return years
      .flatMap((y) => y.months ?? [])
      .flatMap((m) => m.days ?? [])
      .flatMap((d) => d.transactions ?? []);
  }, [years]);

  // -------------------------
  // First-level year/month filtering
  // -------------------------
  const yearMonthFilteredTx = useMemo(() => {
    return allTransactions.filter((t) => {
      const yearObj = years.find((y) => y.id === t.yearId);
      const txYear = yearObj?.year;
      const txMonth = yearObj?.months?.find((m) => m.id === t.monthId)?.name;

      const yearMatch = !selectedYear || selectedYear === txYear;
      const monthMatch = !selectedMonth || selectedMonth === txMonth;

      return yearMatch && monthMatch;
    });
  }, [allTransactions, selectedYear, selectedMonth, years]);

  // -------------------------
  // Available categories
  // -------------------------
  const availableCategories = useMemo(() => {
    return [...new Set(yearMonthFilteredTx.map((t) => t.category))].filter(
      Boolean
    );
  }, [yearMonthFilteredTx]);

  // auto-clear invalid category selections
  useEffect(() => {
    setSelectedCategoryFilters((prev) =>
      prev.filter((cat) => availableCategories.includes(cat))
    );
  }, [availableCategories]);

  // -------------------------
  // SECOND-LEVEL filtering: buckets + categories
  // -------------------------
  const filteredTransactions = useMemo(() => {
    let tx = yearMonthFilteredTx;

    // Apply bucket filter if any
    if (selectedBucketIds.length > 0) {
      const allowedCats = buckets
        .filter((b) => selectedBucketIds.includes(b.id))
        .flatMap((b) => b.categories);

      tx = tx.filter((t) => allowedCats.includes(t.category));
    }

    // Category filters always apply
    if (selectedCategoryFilters.length > 0) {
      tx = tx.filter((t) => selectedCategoryFilters.includes(t.category));
    }

    return tx;
  }, [
    yearMonthFilteredTx,
    selectedBucketIds,
    selectedCategoryFilters,
    buckets,
  ]);

  // -------------------------
  // Pie chart data
  // -------------------------
  const chartData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    if (useBuckets) {
      const result = buckets.reduce((acc, b) => {
        const amt = filteredTransactions
          .filter((t) => b.categories.includes(t.category))
          .reduce((s, t) => s + Number(t.amount ?? 0), 0);

        if (amt > 0) acc.push({ category: b.name, amount: amt });
        return acc;
      }, []);

      const total = result.reduce((s, x) => s + x.amount, 0);
      return result.map((x) => ({
        ...x,
        percent: total ? ((x.amount / total) * 100).toFixed(1) : 0,
      }));
    }

    // Detail mode: aggregate by category
    const map = {};
    filteredTransactions.forEach((t) => {
      if (!t.category) return;
      map[t.category] = (map[t.category] || 0) + Number(t.amount ?? 0);
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0);

    return Object.entries(map).map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percent: total ? ((amt / total) * 100).toFixed(1) : 0,
    }));
  }, [filteredTransactions, useBuckets, buckets]);

  const totalExpenses = chartData.reduce((s, x) => s + x.amount, 0);
  const hasData = chartData.length > 0;

  // -------------------------
  // Monthly totals
  // -------------------------
  const monthlyTotals = useMemo(() => {
    const map = {};

    filteredTransactions.forEach((t) => {
      const y = years.find((yy) => yy.id === t.yearId);
      const m = y?.months?.find((mm) => mm.id === t.monthId);
      if (!y || !m) return;

      const key = `${m.name} ${y.year}`;
      map[key] = (map[key] || 0) + Number(t.amount ?? 0);
    });

    return Object.entries(map)
      .map(([key, total]) => {
        const [month, year] = key.split(" ");
        return { date: new Date(`${month} 1, ${year}`), total };
      })
      .sort((a, b) => a.date - b.date);
  }, [filteredTransactions, years]);

  // -------------------------
  // Importer
  // -------------------------
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImporting(true);
    await importExpenses(file, true);
    setImporting(false);
  };

  // -------------------------
  // Clear filters
  // -------------------------
  const clearFilters = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedBucketIds([]);
    setSelectedCategoryFilters([]);
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-6 relative">
      {/* Top Buttons */}
      <div className="absolute top-6 right-6 flex gap-2">
        <button
          onClick={() => navigate("/settings")}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl"
        >
          Settings
        </button>

        <button
          onClick={exportExpenses}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl"
        >
          Export
        </button>

        <label className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl cursor-pointer">
          {importing ? "Importing..." : "Import"}
          <input
            type="file"
            accept="application/json"
            onChange={handleImport}
            className="hidden"
          />
        </label>

        <button
          onClick={clearFilters}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl"
        >
          Clear Filters
        </button>
      </div>

      {/* FILTERS */}
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
        {/* Row 1: Mode + Year + Month */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Toggle */}
          <label className="group relative w-28 h-7 rounded-full select-none cursor-pointer flex border border-gray-500">
            <input
              type="checkbox"
              className="peer appearance-none hidden"
              checked={useBuckets}
              onChange={() => {
                setUseBuckets(!useBuckets);
                setSelectedCategoryFilters([]); // clear categories on mode switch
              }}
            />
            <div className="absolute left-0 top-0 w-1/2 h-full bg-indigo-500 rounded-full shadow-md transition-all peer-checked:left-1/2"></div>
            <span className="relative w-1/2 flex items-center justify-center text-xs font-medium text-white peer-checked:text-black">
              Detail
            </span>
            <span className="relative w-1/2 flex items-center justify-center text-xs font-medium text-black peer-checked:text-white">
              Bucket
            </span>
          </label>

          {/* Year */}
          <select
            value={selectedYear || ""}
            onChange={(e) =>
              setSelectedYear(e.target.value ? Number(e.target.value) : null)
            }
            className="border px-3 py-2 rounded-lg"
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>

          {/* Month */}
          <select
            value={selectedMonth || ""}
            onChange={(e) => setSelectedMonth(e.target.value || null)}
            className="border px-3 py-2 rounded-lg"
          >
            <option value="">All Months</option>
            {selectedYear &&
              years
                .find((y) => y.year === selectedYear)
                ?.months.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
          </select>
        </div>

        {/* Row 2: Bucket filters (always visible) */}
        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => (
            <label
              key={b.id}
              className={`flex items-center gap-1 text-sm cursor-pointer ${
                selectedBucketIds.includes(b.id)
                  ? "text-indigo-600 font-medium"
                  : "text-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedBucketIds.includes(b.id)}
                onChange={() =>
                  setSelectedBucketIds((prev) =>
                    prev.includes(b.id)
                      ? prev.filter((x) => x !== b.id)
                      : [...prev, b.id]
                  )
                }
                className="accent-indigo-500"
              />
              {b.name}
            </label>
          ))}
        </div>

        {/* Row 3: Category filters (only from selected buckets) */}
        {selectedBucketIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {buckets
              .filter((b) => selectedBucketIds.includes(b.id))
              .flatMap((b) => b.categories)
              .filter((c, i, arr) => arr.indexOf(c) === i)
              .map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-1 text-xs cursor-pointer text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryFilters.includes(cat)}
                    onChange={() =>
                      setSelectedCategoryFilters((prev) =>
                        prev.includes(cat)
                          ? prev.filter((x) => x !== cat)
                          : [...prev, cat]
                      )
                    }
                    className="accent-indigo-500"
                  />
                  {cat}
                </label>
              ))}
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Row 1 */}
        <div className="bg-white shadow-lg rounded-2xl p-6 flex flex-col md:flex-row gap-6">
          <div className="flex-1 flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-sm text-gray-500 uppercase tracking-wide">
                Total Expenses
              </h2>
              <p className="text-4xl font-bold text-indigo-600">
                ₱
                {totalExpenses.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>

            {hasData ? (
              <ExpensePieChart data={chartData} />
            ) : (
              <p className="text-gray-500 text-center mt-8">
                No expenses recorded yet.
              </p>
            )}
          </div>

          {/* Breakdown */}
          {hasData && (
            <div className="flex-[0.8] flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[500px]">
                {chartData
                  .sort((a, b) => b.amount - a.amount)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm flex flex-col items-center"
                    >
                      <h2 className="font-semibold text-gray-800">
                        {item.category}
                      </h2>
                      <p className="text-lg font-bold text-indigo-600">
                        ₱
                        {item.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-sm text-gray-500">{item.percent}%</p>
                    </div>
                  ))}
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate("/expenses")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl"
                >
                  See Breakdown
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Monthly chart */}
        {hasData && monthlyTotals.length > 0 && (
          <div className="bg-white shadow-lg rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">
              Monthly Spending
            </h3>
            <MonthlySpendChart data={monthlyTotals} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
