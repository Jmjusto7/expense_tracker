import ExpensePieChart from "../components/ExpensePieChart";
import MonthlySpendChart from "../components/MonthlySpendChart";
import { useNavigate } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useState, useMemo, useEffect } from "react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";

const monthIndex = (monthName) =>
  new Date(`${monthName} 1, 2000`).getMonth(); // helper for date comparisons

const SummaryPage = () => {
  const navigate = useNavigate();
  const { years, exportExpenses, importExpenses, getBucketsWithCategories } =
    useExpenseContext();

  const [importing, setImporting] = useState(false);

  // -------------------------
  // Time slicers
  // -------------------------
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  // -------------------------
  // Bucket toggle & filters
  // -------------------------
  const [useBuckets, setUseBuckets] = useState(true);
  const [buckets, setBuckets] = useState([]);
  const [selectedBucketIds, setSelectedBucketIds] = useState([]);
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
  // Time filtering
  // -------------------------
  const timeFilteredTx = useMemo(() => {
    return allTransactions.filter((t) => {
      const yearObj = years.find((y) => y.id === t.yearId);
      const monthObj = yearObj?.months?.find((m) => m.id === t.monthId);
      if (!yearObj || !monthObj) return false;

      const txDate = new Date(yearObj.year, monthIndex(monthObj.name), 1);

      const afterFrom = !fromDate || txDate >= fromDate;
      const beforeTo = !toDate || txDate <= toDate;

      return afterFrom && beforeTo;
    });
  }, [allTransactions, fromDate, toDate, years]);

  // -------------------------
  // Available categories
  // -------------------------
  const availableCategories = useMemo(() => {
    return [...new Set(timeFilteredTx.map((t) => t.category))].filter(
      Boolean
    );
  }, [timeFilteredTx]);

  // auto-clear invalid category selections
  useEffect(() => {
    setSelectedCategoryFilters((prev) =>
      prev.filter((cat) => availableCategories.includes(cat))
    );
  }, [availableCategories]);

  // -------------------------
  // Bucket + category filtering
  // -------------------------
  const filteredTransactions = useMemo(() => {
    let tx = timeFilteredTx;

    if (selectedBucketIds.length > 0) {
      const allowedCats = buckets
        .filter((b) => selectedBucketIds.includes(b.id))
        .flatMap((b) => b.categories);
      tx = tx.filter((t) => allowedCats.includes(t.category));
    }

    if (selectedCategoryFilters.length > 0) {
      tx = tx.filter((t) => selectedCategoryFilters.includes(t.category));
    }

    return tx;
  }, [timeFilteredTx, selectedBucketIds, selectedCategoryFilters, buckets]);

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

    // Detail mode
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
  // Importer & clear filters
  // -------------------------
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImporting(true);
    await importExpenses(file, true);
    setImporting(false);
  };

  const clearFilters = () => {
    setFromDate(null);
    setToDate(null);
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

        <button
          onClick={() => navigate("/travels")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
        >
          Manage Travel
        </button>
      </div>

      {/* FILTERS */}
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
        {/* Row 1: Bucket toggle + Time slicers */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Toggle */}
          <label className="group relative w-28 h-7 rounded-full select-none cursor-pointer flex border border-gray-500">
            <input
              type="checkbox"
              className="peer appearance-none hidden"
              checked={useBuckets}
              onChange={() => {
                setUseBuckets(!useBuckets);
                setSelectedCategoryFilters([]);
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

          {/* From / To DatePickers */}
          <div>
            <label className="block text-xs text-gray-600">From</label>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">To</label>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
            />
          </div>
        </div>

        {/* Row 2: Bucket filters */}
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

        {/* Row 3: Category filters */}
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
