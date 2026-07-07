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
import { ArrowUpRight, ArrowDownRight, Minus, Plane, ChevronRight } from "lucide-react";
import { TRAVEL_FILTER_ID } from "../utils/travelHelpers";
import { transactionMatchesBucketAndCategory } from "../utils/transactionFilter";
import {
  classifyTransactions,
  groupByEffectiveBucket,
  groupByCategory,
  getAvailableCategories,
} from "../utils/transactionClassification";

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
    travelDrillBucketId,
    setTravelDrillBucketId,
    isTravelSelected,
    travelScopedClassifiedTx,
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

  // Are we currently drilling inside Travel?
  const isInsideTravelDrill = selectedBucketIds.length === 1 && selectedBucketIds[0] === TRAVEL_FILTER_ID;
  const travelDrillBucket = buckets.find((b) => b.id === travelDrillBucketId) || null;

  // -------------------------
  // Time filtering (date-only stage, needed in isolation to compute
  // travel-linked categories before bucket/category narrowing)
  // -------------------------
  const timeFilteredTx = useMemo(() => {
    return allTransactions.filter(matchesDate);
  }, [allTransactions, matchesDate]);

  // Classify all time-filtered transactions with their effective bucket
  const classifiedTx = useMemo(() => {
    return classifyTransactions(timeFilteredTx, buckets);
  }, [timeFilteredTx, buckets]);

  // Categories that appear on any travel-tagged transaction. Powers the
  // sub-filter row shown when the "Travel" pill is selected.
  const travelLinkedCategories = useMemo(() => {
    return getAvailableCategories(classifiedTx, [TRAVEL_FILTER_ID]);
  }, [classifiedTx]);

  // -------------------------
  // Bucket + category filtering (uses classification-aware filter)
  // -------------------------
  const filteredTransactions = useMemo(() => {
    return classifiedTx.filter((t) =>
      transactionMatchesBucketAndCategory(t, { selectedBucketIds, selectedCategoryFilters, buckets })
    );
  }, [classifiedTx, selectedBucketIds, selectedCategoryFilters, buckets]);

  // Determine current drill-down level:
  // - Level 1: Top buckets (no bucket selected, or non-Travel bucket selected)
  // - Level 2: Inside Travel, showing buckets (Travel selected, no travelDrillBucketId)
  // - Level 3: Inside Travel → Bucket, showing categories (Travel selected + travelDrillBucketId)
  const isLevel2TravelBuckets = isInsideTravelDrill && useBuckets && !travelDrillBucketId;
  const isLevel3TravelCategories = isInsideTravelDrill && useBuckets && travelDrillBucketId;

  // For standard bucket flow: bucket filter active means show categories
  const isCategoryLevel = !useBuckets || (selectedBucketIds.length > 0 && !isLevel2TravelBuckets);

  // -------------------------
  // Pie chart / breakdown data (uses native classification)
  // Supports 3-level Travel drill-down:
  //   L1: Top buckets (Travel is one slice)
  //   L2: Travel selected → buckets within travel
  //   L3: Travel → Bucket selected → categories within that bucket
  // -------------------------
  const chartData = useMemo(() => {
    // Level 2: Inside Travel, show buckets (using travel-scoped classification)
    if (isLevel2TravelBuckets) {
      if (travelScopedClassifiedTx.length === 0) return [];

      const bucketGroups = groupByEffectiveBucket(travelScopedClassifiedTx);
      const total = [...bucketGroups.values()].reduce((s, g) => s + g.total, 0);

      return [...bucketGroups.values()]
        .filter((g) => g.total > 0)
        .map((g) => ({
          category: g.bucketLabel,
          amount: g.total,
          bucketId: g.bucketId,
          percent: total ? ((g.total / total) * 100).toFixed(1) : 0,
        }));
    }

    // Level 3: Inside Travel → Bucket, show categories
    if (isLevel3TravelCategories) {
      const scopedToTravelBucket = travelScopedClassifiedTx.filter(
        (t) => t.effectiveBucketId === travelDrillBucketId
      );
      // Also apply category filter if active
      const finalScoped = selectedCategoryFilters.length > 0
        ? scopedToTravelBucket.filter((t) => selectedCategoryFilters.includes(t.category))
        : scopedToTravelBucket;

      if (finalScoped.length === 0) return [];

      const categoryGroups = groupByCategory(finalScoped);
      const total = [...categoryGroups.values()].reduce((s, g) => s + g.total, 0);

      return [...categoryGroups.values()]
        .filter((g) => g.total > 0)
        .map((g) => ({
          category: g.category,
          amount: g.total,
          percent: total ? ((g.total / total) * 100).toFixed(1) : 0,
        }));
    }

    // Standard flow
    if (filteredTransactions.length === 0) return [];

    if (useBuckets && !isCategoryLevel) {
      // Level 1: Top-level bucket view (Travel is its own bucket)
      const bucketGroups = groupByEffectiveBucket(filteredTransactions);
      const total = [...bucketGroups.values()].reduce((s, g) => s + g.total, 0);

      return [...bucketGroups.values()]
        .filter((g) => g.total > 0)
        .map((g) => ({
          category: g.bucketLabel,
          amount: g.total,
          bucketId: g.bucketId,
          percent: total ? ((g.total / total) * 100).toFixed(1) : 0,
        }));
    }

    // Category-level view: Detail mode, or drilled into a non-Travel bucket
    const categoryGroups = groupByCategory(filteredTransactions);
    const total = [...categoryGroups.values()].reduce((s, g) => s + g.total, 0);

    return [...categoryGroups.values()]
      .filter((g) => g.total > 0)
      .map((g) => ({
        category: g.category,
        amount: g.total,
        percent: total ? ((g.total / total) * 100).toFixed(1) : 0,
      }));
  }, [filteredTransactions, useBuckets, isCategoryLevel, isLevel2TravelBuckets, isLevel3TravelCategories, travelScopedClassifiedTx, travelDrillBucketId, selectedCategoryFilters]);

  const totalExpenses = chartData.reduce((s, x) => s + x.amount, 0);
  const hasData = chartData.length > 0;

  // -------------------------
  // Monthly totals (use travel-scoped data when drilling inside Travel)
  // -------------------------
  const monthlyTotals = useMemo(() => {
    // Determine which transactions to use for monthly chart
    let txForMonthly = filteredTransactions;
    if (isLevel2TravelBuckets) {
      txForMonthly = travelScopedClassifiedTx;
    } else if (isLevel3TravelCategories) {
      const scopedToTravelBucket = travelScopedClassifiedTx.filter(
        (t) => t.effectiveBucketId === travelDrillBucketId
      );
      txForMonthly = selectedCategoryFilters.length > 0
        ? scopedToTravelBucket.filter((t) => selectedCategoryFilters.includes(t.category))
        : scopedToTravelBucket;
    }

    const map = {};
    txForMonthly.forEach((t) => {
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
  }, [filteredTransactions, isLevel2TravelBuckets, isLevel3TravelCategories, travelScopedClassifiedTx, travelDrillBucketId, selectedCategoryFilters]);

  // -------------------------
  // Headline stats (use correct data source for travel drill-down)
  // -------------------------
  const transactionCount = useMemo(() => {
    if (isLevel2TravelBuckets) return travelScopedClassifiedTx.length;
    if (isLevel3TravelCategories) {
      const scopedToTravelBucket = travelScopedClassifiedTx.filter(
        (t) => t.effectiveBucketId === travelDrillBucketId
      );
      return selectedCategoryFilters.length > 0
        ? scopedToTravelBucket.filter((t) => selectedCategoryFilters.includes(t.category)).length
        : scopedToTravelBucket.length;
    }
    return filteredTransactions.length;
  }, [filteredTransactions, isLevel2TravelBuckets, isLevel3TravelCategories, travelScopedClassifiedTx, travelDrillBucketId, selectedCategoryFilters]);

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
  // Handles 3-level Travel drill-down
  // -------------------------
  const breakdownItems = useMemo(() => {
    // Determine if we're showing buckets (L1 or L2) or categories (L3 or standard category level)
    const showingBuckets = (useBuckets && !isCategoryLevel) || isLevel2TravelBuckets;
    const showingCategories = isLevel3TravelCategories || (isCategoryLevel && !isLevel2TravelBuckets);

    return [...chartData]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        key: showingCategories ? item.category : item.bucketId ?? "unassigned",
        label: item.category,
        amountDisplay: formatCurrencyPrecise(item.amount),
        percent: item.percent,
        disabled: showingBuckets && item.bucketId == null,
        bucketId: item.bucketId,
        category: item.category,
      }));
  }, [chartData, isCategoryLevel, useBuckets, isLevel2TravelBuckets, isLevel3TravelCategories]);

  // Active keys depend on current drill level
  const breakdownActiveKeys = useMemo(() => {
    if (isLevel3TravelCategories) return selectedCategoryFilters;
    if (isLevel2TravelBuckets) return travelDrillBucketId ? [travelDrillBucketId] : [];
    return isCategoryLevel ? selectedCategoryFilters : selectedBucketIds;
  }, [isCategoryLevel, isLevel2TravelBuckets, isLevel3TravelCategories, selectedBucketIds, selectedCategoryFilters, travelDrillBucketId]);

  const handleBreakdownClick = (item) => {
    // Level 2: Inside Travel, clicking a bucket drills to Level 3
    if (isLevel2TravelBuckets) {
      if (item.bucketId != null) {
        setTravelDrillBucketId(item.bucketId);
      }
      return;
    }

    // Level 3: Inside Travel → Bucket, clicking a category toggles filter
    if (isLevel3TravelCategories) {
      setSelectedCategoryFilters((prev) =>
        prev.includes(item.category)
          ? prev.filter((x) => x !== item.category)
          : [...prev, item.category]
      );
      return;
    }

    // Standard flow
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

  // Reset travel drill-down when leaving Travel filter
  const handleClearTravelDrill = () => {
    setTravelDrillBucketId(null);
    setSelectedCategoryFilters([]);
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
                setTravelDrillBucketId(null);
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

        {/* Bucket filter pills (hidden when inside Travel drill-down) */}
        {(buckets.length > 0 || travelLinkedCategories.length > 0) && !isInsideTravelDrill && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
            {buckets.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setTravelDrillBucketId(null);
                  setSelectedBucketIds((prev) =>
                    prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                  );
                }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedBucketIds.includes(b.id)
                  ? "bg-ledger text-white border-ledger"
                  : "border-border text-ink-muted hover:border-ledger hover:text-ledger-dark"
                  }`}
              >
                {b.name}
              </button>
            ))}

            {/* Synthetic "Travel" pill - selecting it enters Travel drill-down */}
            <button
              onClick={() => {
                setTravelDrillBucketId(null);
                setSelectedCategoryFilters([]);
                setSelectedBucketIds((prev) =>
                  prev.includes(TRAVEL_FILTER_ID)
                    ? prev.filter((x) => x !== TRAVEL_FILTER_ID)
                    : [TRAVEL_FILTER_ID]
                );
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedBucketIds.includes(TRAVEL_FILTER_ID)
                ? "bg-travel text-white border-travel"
                : "border-travel/40 text-travel-dark hover:border-travel"
                }`}
            >
              <Plane size={11} />
              Travel
            </button>
          </div>
        )}

        {/* Travel drill-down breadcrumb navigation */}
        {isInsideTravelDrill && useBuckets && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-border text-sm">
            <button
              onClick={() => {
                setTravelDrillBucketId(null);
                setSelectedCategoryFilters([]);
                setSelectedBucketIds([]);
              }}
              className="text-ink-muted hover:text-ink"
            >
              All Buckets
            </button>
            <ChevronRight size={14} className="text-ink-muted" />
            <button
              onClick={() => {
                setTravelDrillBucketId(null);
                setSelectedCategoryFilters([]);
              }}
              className={`flex items-center gap-1 ${travelDrillBucketId ? "text-ink-muted hover:text-ink" : "font-semibold text-travel-dark"}`}
            >
              <Plane size={12} />
              Travel
            </button>
            {travelDrillBucket && (
              <>
                <ChevronRight size={14} className="text-ink-muted" />
                <span className="font-semibold text-ink">{travelDrillBucket.name}</span>
              </>
            )}
          </div>
        )}

        {/* Category filter pills for Level 3 (Travel → Bucket → Categories) */}
        {isLevel3TravelCategories && (
          <div className="flex flex-wrap gap-1.5">
            {getAvailableCategories(
              travelScopedClassifiedTx.filter((t) => t.effectiveBucketId === travelDrillBucketId),
              []
            ).map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategoryFilters((prev) =>
                    prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                  )
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedCategoryFilters.includes(cat)
                  ? "bg-travel-soft text-travel-dark border-travel/40"
                  : "border-border text-ink-muted hover:border-travel"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Category filter pills for standard bucket selection (non-Travel) */}
        {selectedBucketIds.length > 0 && !isInsideTravelDrill && (
          <div className="flex flex-wrap gap-1.5">
            {getAvailableCategories(classifiedTx, selectedBucketIds).map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategoryFilters((prev) =>
                    prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                  )
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedCategoryFilters.includes(cat)
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
                  className={`flex items-center gap-1 text-2xl font-bold ${momDelta.pct > 0
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
                label={
                  isLevel2TravelBuckets ? "Top Bucket (Travel)" :
                    isLevel3TravelCategories ? "Top Category (Travel)" :
                      isCategoryLevel ? "Top Category" : "Top Bucket"
                }
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
                  {isLevel2TravelBuckets
                    ? "Click a bucket to see its categories within Travel"
                    : isLevel3TravelCategories
                      ? "Click a category to filter"
                      : isCategoryLevel
                        ? "Click a category to narrow further"
                        : "Click a bucket to see its categories"}
                </div>
                <BreakdownGrid
                  items={breakdownItems}
                  activeKeys={breakdownActiveKeys}
                  onItemClick={handleBreakdownClick}
                  accent={isInsideTravelDrill ? "travel" : "ledger"}
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
