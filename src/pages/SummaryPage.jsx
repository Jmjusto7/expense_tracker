import ExpensePieChart from "../components/ExpensePieChart";
import MonthlySpendChart from "../components/MonthlySpendChart";
import StatCard from "../components/StatCard";
import BreakdownGrid from "../components/BreakdownGrid";
import { useNavigate } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
import { useState, useMemo } from "react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency, formatCurrencyPrecise } from "../utils/formatCurrency";
import { ArrowUpRight, ArrowDownRight, Minus, Plane } from "lucide-react";
import { TRAVEL_FILTER_ID } from "../utils/travelHelpers";
import { transactionMatchesBucketAndCategory } from "../utils/transactionFilter";

const SummaryPage = () => {
  const navigate = useNavigate();
  const { allTransactions } = useExpenseContext();
  const {
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
    matchesDate,
  } = useFilter();

  // -------------------------
  // Bucket vs Detail chart mode - purely a display concern for this page's
  // chart, not part of the shared filter (Expenses pages don't care how
  // Summary chooses to group its chart).
  // -------------------------
  const [useBuckets, setUseBuckets] = useState(true);

  // -------------------------
  // Time filtering (date-only stage, needed in isolation to compute
  // travel-linked categories before bucket/category narrowing)
  // -------------------------
  const timeFilteredTx = useMemo(() => {
    return allTransactions.filter(matchesDate);
  }, [allTransactions, matchesDate]);

  // Categories that appear on any travel-tagged transaction, regardless of
  // which real bucket they belong to. Powers the sub-filter row shown when
  // the "Travel" pill is selected.
  const travelLinkedCategories = useMemo(() => {
    return [...new Set(
      timeFilteredTx.filter((t) => t.travelId != null).map((t) => t.category)
    )].filter(Boolean);
  }, [timeFilteredTx]);

  // -------------------------
  // Bucket + category filtering
  // -------------------------
  const filteredTransactions = useMemo(() => {
    return timeFilteredTx.filter((t) =>
      transactionMatchesBucketAndCategory(t, { selectedBucketIds, selectedCategoryFilters, buckets })
    );
  }, [timeFilteredTx, selectedBucketIds, selectedCategoryFilters, buckets]);

  // Once a bucket filter is active, the chart should break down into that
  // bucket's constituent categories rather than showing one lone
  // bucket-level slice (which is just the sum again). Detail mode is
  // always category-level.
  const isCategoryLevel = !useBuckets || selectedBucketIds.length > 0;

  // -------------------------
  // Pie chart / breakdown data
  // -------------------------
  const chartData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];

    if (useBuckets && !isCategoryLevel) {
      // Top-level bucket view: one slice per bucket.
      // Travel-tagged spend gets its own slice regardless of which bucket
      // its category belongs to - pulled out of the normal grouping so
      // slices don't double-count.
      const travelTx = filteredTransactions.filter((t) => t.travelId != null);
      const nonTravelTx = filteredTransactions.filter((t) => t.travelId == null);

      const bucketedCategories = new Set(buckets.flatMap((b) => b.categories));

      const result = buckets.reduce((acc, b) => {
        const amt = nonTravelTx
          .filter((t) => b.categories.includes(t.category))
          .reduce((s, t) => s + Number(t.amount ?? 0), 0);

        if (amt > 0) acc.push({ category: b.name, amount: amt, bucketId: b.id });
        return acc;
      }, []);

      // Categories not yet assigned to any bucket would otherwise
      // disappear from bucket-mode totals entirely. Surface them
      // under "Unassigned" instead of silently dropping the spend.
      const unassignedAmt = nonTravelTx
        .filter((t) => t.category && !bucketedCategories.has(t.category))
        .reduce((s, t) => s + Number(t.amount ?? 0), 0);

      if (unassignedAmt > 0) {
        result.push({ category: "Unassigned", amount: unassignedAmt, bucketId: null });
      }

      const travelAmt = travelTx.reduce((s, t) => s + Number(t.amount ?? 0), 0);
      if (travelAmt > 0) {
        result.push({ category: "Travel", amount: travelAmt, bucketId: TRAVEL_FILTER_ID });
      }

      const total = result.reduce((s, x) => s + x.amount, 0);
      return result.map((x) => ({
        ...x,
        percent: total ? ((x.amount / total) * 100).toFixed(1) : 0,
      }));
    }

    // Category-level view: either Detail mode, or drilled into a bucket
    // filter. filteredTransactions is already scoped to the selected
    // bucket(s)/Travel, so grouping by category here is the breakdown
    // of what's inside that selection - not a fresh top-level total.
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
  }, [filteredTransactions, useBuckets, isCategoryLevel, buckets]);

  const totalExpenses = chartData.reduce((s, x) => s + x.amount, 0);
  const hasData = chartData.length > 0;

  // -------------------------
  // Monthly totals
  // -------------------------
  const monthlyTotals = useMemo(() => {
    const map = {};
    filteredTransactions.forEach((t) => {
      if (!t.yearNumber || !t.monthName) return;

      const key = `${t.monthName} ${t.yearNumber}`;
      map[key] = (map[key] || 0) + Number(t.amount ?? 0);
    });

    return Object.entries(map)
      .map(([key, total]) => {
        const [month, year] = key.split(" ");
        return { date: new Date(`${month} 1, ${year}`), total };
      })
      .sort((a, b) => a.date - b.date);
  }, [filteredTransactions]);

  // -------------------------
  // Headline stats
  // -------------------------
  const transactionCount = filteredTransactions.length;
  const avgPerMonth = monthlyTotals.length ? totalExpenses / monthlyTotals.length : 0;
  const topItem = [...chartData].sort((a, b) => b.amount - a.amount)[0];

  // Month-over-month delta on the two most recent months in view
  const momDelta = useMemo(() => {
    if (monthlyTotals.length < 2) return null;
    const prev = monthlyTotals[monthlyTotals.length - 2];
    const curr = monthlyTotals[monthlyTotals.length - 1];
    if (!prev.total) return null;
    return {
      pct: ((curr.total - prev.total) / prev.total) * 100,
      currLabel: formatMonthYear(curr.date),
    };
  }, [monthlyTotals]);

  // -------------------------
  // Breakdown grid data - click drills the actual filter, doesn't just decorate
  // -------------------------
  const breakdownItems = useMemo(() => {
    return [...chartData]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        key: isCategoryLevel ? item.category : item.bucketId ?? "unassigned",
        label: item.category,
        amountDisplay: formatCurrencyPrecise(item.amount),
        percent: item.percent,
        disabled: !isCategoryLevel && item.bucketId == null,
        bucketId: item.bucketId,
        category: item.category,
      }));
  }, [chartData, isCategoryLevel]);

  const breakdownActiveKeys = isCategoryLevel ? selectedCategoryFilters : selectedBucketIds;

  const handleBreakdownClick = (item) => {
    if (isCategoryLevel) {
      setSelectedCategoryFilters((prev) =>
        prev.includes(item.category)
          ? prev.filter((x) => x !== item.category)
          : [...prev, item.category]
      );
    } else {
      setSelectedBucketIds((prev) =>
        prev.includes(item.bucketId)
          ? prev.filter((x) => x !== item.bucketId)
          : [...prev, item.bucketId]
      );
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* FILTER TOOLBAR */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Detail / Bucket toggle */}
          <label className="group relative w-28 h-7 rounded-full select-none cursor-pointer flex border border-border shrink-0">
            <input
              type="checkbox"
              className="peer appearance-none hidden"
              checked={useBuckets}
              onChange={() => {
                setUseBuckets(!useBuckets);
                setSelectedCategoryFilters([]);
              }}
            />
            <div className="absolute left-0 top-0 w-1/2 h-full bg-ledger rounded-full transition-all peer-checked:left-1/2"></div>
            <span className="relative w-1/2 flex items-center justify-center text-xs font-medium text-white peer-checked:text-ink">
              Detail
            </span>
            <span className="relative w-1/2 flex items-center justify-center text-xs font-medium text-ink peer-checked:text-white">
              Bucket
            </span>
          </label>

          {/* From / To DatePickers */}
          <div>
            <label className="block text-xs text-ink-muted mb-0.5">From</label>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-0.5">To</label>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-ink-muted hover:text-ink underline underline-offset-2 ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Bucket filter pills */}
        {(buckets.length > 0 || travelLinkedCategories.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
            {buckets.map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  setSelectedBucketIds((prev) =>
                    prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                  )
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedBucketIds.includes(b.id)
                    ? "bg-ledger text-white border-ledger"
                    : "border-border text-ink-muted hover:border-ledger hover:text-ledger-dark"
                }`}
              >
                {b.name}
              </button>
            ))}

            {/* Synthetic "Travel" pill - not a real bucket. Selecting it
                shows spend across any travel-tagged transaction, regardless
                of that transaction's category/bucket. */}
            <button
              onClick={() =>
                setSelectedBucketIds((prev) =>
                  prev.includes(TRAVEL_FILTER_ID)
                    ? prev.filter((x) => x !== TRAVEL_FILTER_ID)
                    : [...prev, TRAVEL_FILTER_ID]
                )
              }
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedBucketIds.includes(TRAVEL_FILTER_ID)
                  ? "bg-travel text-white border-travel"
                  : "border-travel/40 text-travel-dark hover:border-travel"
              }`}
            >
              <Plane size={11} />
              Travel
            </button>
          </div>
        )}

        {/* Category filter pills, scoped to selected buckets (+ any
            travel-linked categories, if the Travel pill is selected) */}
        {selectedBucketIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[
              ...new Set([
                ...buckets
                  .filter((b) => selectedBucketIds.includes(b.id))
                  .flatMap((b) => b.categories),
                ...(selectedBucketIds.includes(TRAVEL_FILTER_ID) ? travelLinkedCategories : []),
              ]),
            ].map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategoryFilters((prev) =>
                    prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                  )
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedCategoryFilters.includes(cat)
                    ? "bg-ledger-soft text-ledger-dark border-ledger/40"
                    : "border-border text-ink-muted hover:border-ledger"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasData ? (
        <div className="flex flex-col gap-6">
          {/* STAT CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Expenses" value={formatCurrencyPrecise(totalExpenses)} />
            <StatCard
              label="Transactions"
              value={transactionCount.toLocaleString()}
              sublabel={monthlyTotals.length ? `across ${monthlyTotals.length} month${monthlyTotals.length === 1 ? "" : "s"}` : undefined}
            />
            <StatCard label="Avg / Month" value={formatCurrency(avgPerMonth)} />
            {momDelta ? (
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">
                  vs Previous Month
                </div>
                <div
                  className={`flex items-center gap-1 text-2xl font-bold ${
                    momDelta.pct > 0
                      ? "text-alert"
                      : momDelta.pct < 0
                      ? "text-ledger-dark"
                      : "text-ink-muted"
                  }`}
                >
                  {momDelta.pct > 0 ? (
                    <ArrowUpRight size={20} />
                  ) : momDelta.pct < 0 ? (
                    <ArrowDownRight size={20} />
                  ) : (
                    <Minus size={20} />
                  )}
                  {Math.abs(momDelta.pct).toFixed(0)}%
                </div>
                <div className="text-xs text-ink-muted mt-1">{momDelta.currLabel}</div>
              </div>
            ) : (
              <StatCard
                label={isCategoryLevel ? "Top Category" : "Top Bucket"}
                value={topItem ? `${topItem.percent}%` : "—"}
                sublabel={topItem?.category}
              />
            )}
          </div>

          {/* PIE + BREAKDOWN */}
          <div className="bg-surface border border-border rounded-lg p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col items-center">
              <ExpensePieChart data={chartData} />
            </div>

            <div className="flex-[0.8] flex flex-col gap-4">
              <div>
                <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">
                  {isCategoryLevel
                    ? "Click a category to narrow further"
                    : "Click a bucket to see its categories"}
                </div>
                <BreakdownGrid
                  items={breakdownItems}
                  activeKeys={breakdownActiveKeys}
                  onItemClick={handleBreakdownClick}
                  accent="ledger"
                />
              </div>

              <button
                onClick={() => navigate("/expenses")}
                className="bg-ledger hover:bg-ledger-dark text-white px-6 py-3 rounded-lg transition-colors text-sm font-medium"
              >
                See Full Breakdown
              </button>
            </div>
          </div>

          {/* MONTHLY TREND */}
          {monthlyTotals.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-6">
              <h3 className="text-base font-semibold mb-3 text-ink">Monthly Spending</h3>
              <MonthlySpendChart data={monthlyTotals} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-ink-muted text-center py-16">No expenses recorded yet.</p>
      )}
    </div>
  );
};

export default SummaryPage;
