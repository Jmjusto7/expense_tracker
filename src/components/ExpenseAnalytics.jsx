import { useState, useMemo } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
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
import ExpensePieChart from "./ExpensePieChart";
import MonthlySpendChart from "./MonthlySpendChart";
import StatCard from "./StatCard";
import BreakdownGrid from "./BreakdownGrid";

// Date filtering is month-granular (see transactionMatchesDate), so ranges are first-of-month dates.
const monthStart = (d, offset = 0) => new Date(d.getFullYear(), d.getMonth() + offset, 1);
const DATE_PRESETS = [
  { label: "This month", range: (now) => [monthStart(now), monthStart(now)] },
  { label: "Last month", range: (now) => [monthStart(now, -1), monthStart(now, -1)] },
  { label: "This year", range: (now) => [new Date(now.getFullYear(), 0, 1), monthStart(now)] },
  { label: "Last 12 months", range: (now) => [monthStart(now, -11), monthStart(now)] },
];
const sameMonth = (a, b) =>
  a instanceof Date && b instanceof Date && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// This is the bucket/category drill-down + stat cards + monthly trend that
// used to be the entire Home page. It moved here once filter-*setting*
// (as opposed to filter *removal*, which FilterBar elsewhere still does)
// was decided to belong on the Expenses tab rather than the dashboard -
// you're already looking at transactions here, so this is where narrowing
// them down naturally belongs.
export default function ExpenseAnalytics() {
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
    travelScopedClassifiedTx,
    hasActiveFilters,
    clearFilters,
    matchesDate,
  } = useFilter();

  // -------------------------
  // Bucket vs Detail chart mode - purely a display concern for this
  // component's own chart, not part of the shared filter.
  // -------------------------
  const [useBuckets, setUseBuckets] = useState(true);

  const isInsideTravelDrill = selectedBucketIds.length === 1 && selectedBucketIds[0] === TRAVEL_FILTER_ID;
  const travelDrillBucket = buckets.find((b) => b.id === travelDrillBucketId) || null;

  const timeFilteredTx = useMemo(() => {
    return allTransactions.filter(matchesDate);
  }, [allTransactions, matchesDate]);

  const classifiedTx = useMemo(() => {
    return classifyTransactions(timeFilteredTx, buckets);
  }, [timeFilteredTx, buckets]);

  const travelLinkedCategories = useMemo(() => {
    return getAvailableCategories(classifiedTx, [TRAVEL_FILTER_ID]);
  }, [classifiedTx]);

  const filteredTransactions = useMemo(() => {
    return classifiedTx.filter((t) =>
      transactionMatchesBucketAndCategory(t, { selectedBucketIds, selectedCategoryFilters, buckets })
    );
  }, [classifiedTx, selectedBucketIds, selectedCategoryFilters, buckets]);

  // Drill-down level:
  // - L1: Top buckets (no bucket selected, or non-Travel bucket selected)
  // - L2: Inside Travel, showing buckets (Travel selected, no travelDrillBucketId)
  // - L3: Inside Travel -> Bucket, showing categories
  const isLevel2TravelBuckets = isInsideTravelDrill && useBuckets && !travelDrillBucketId;
  const isLevel3TravelCategories = isInsideTravelDrill && useBuckets && travelDrillBucketId;
  const isCategoryLevel = !useBuckets || (selectedBucketIds.length > 0 && !isLevel2TravelBuckets);

  // Pie slices can only show positive groups; percentages are of the slices shown.
  const toSlices = (groups, describe) => {
    const positive = [...groups.values()].filter((g) => g.total > 0);
    const total = positive.reduce((s, g) => s + g.total, 0);
    return positive.map((g) => ({
      ...describe(g),
      amount: g.total,
      percent: total ? ((g.total / total) * 100).toFixed(1) : 0,
    }));
  };
  const bucketSlice = (g) => ({ category: g.bucketLabel, bucketId: g.bucketId });
  const categorySlice = (g) => ({ category: g.category });

  const chartData = useMemo(() => {
    if (isLevel2TravelBuckets) {
      if (travelScopedClassifiedTx.length === 0) return [];
      return toSlices(groupByEffectiveBucket(travelScopedClassifiedTx), bucketSlice);
    }

    if (isLevel3TravelCategories) {
      const scopedToTravelBucket = travelScopedClassifiedTx.filter(
        (t) => t.effectiveBucketId === travelDrillBucketId
      );
      const finalScoped = selectedCategoryFilters.length > 0
        ? scopedToTravelBucket.filter((t) => selectedCategoryFilters.includes(t.category))
        : scopedToTravelBucket;

      if (finalScoped.length === 0) return [];
      return toSlices(groupByCategory(finalScoped), categorySlice);
    }

    if (filteredTransactions.length === 0) return [];

    if (useBuckets && !isCategoryLevel) {
      return toSlices(groupByEffectiveBucket(filteredTransactions), bucketSlice);
    }

    return toSlices(groupByCategory(filteredTransactions), categorySlice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions, useBuckets, isCategoryLevel, isLevel2TravelBuckets, isLevel3TravelCategories, travelScopedClassifiedTx, travelDrillBucketId, selectedCategoryFilters]);

  const hasData = chartData.length > 0;

  const monthlyTotals = useMemo(() => {
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

  // Signed (refunds included), so it matches Home and the month totals; the pie shows positives only.
  const totalExpenses = monthlyTotals.reduce((s, m) => s + m.total, 0);
  const excludedFromPie = chartData.reduce((s, x) => s + x.amount, 0) - totalExpenses;

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

  const breakdownItems = useMemo(() => {
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

  const breakdownActiveKeys = useMemo(() => {
    if (isLevel3TravelCategories) return selectedCategoryFilters;
    if (isLevel2TravelBuckets) return travelDrillBucketId ? [travelDrillBucketId] : [];
    return isCategoryLevel ? selectedCategoryFilters : selectedBucketIds;
  }, [isCategoryLevel, isLevel2TravelBuckets, isLevel3TravelCategories, selectedBucketIds, selectedCategoryFilters, travelDrillBucketId]);

  const handleBreakdownClick = (item) => {
    if (isLevel2TravelBuckets) {
      if (item.bucketId != null) {
        setTravelDrillBucketId(item.bucketId);
      }
      return;
    }

    if (isLevel3TravelCategories) {
      setSelectedCategoryFilters((prev) =>
        prev.includes(item.category) ? prev.filter((x) => x !== item.category) : [...prev, item.category]
      );
      return;
    }

    if (isCategoryLevel) {
      setSelectedCategoryFilters((prev) =>
        prev.includes(item.category) ? prev.filter((x) => x !== item.category) : [...prev, item.category]
      );
    } else {
      setSelectedBucketIds((prev) =>
        prev.includes(item.bucketId) ? prev.filter((x) => x !== item.bucketId) : [...prev, item.bucketId]
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 mb-8">
      {/* FILTER TOOLBAR */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-4 items-center">
          <div role="group" aria-label="Group chart by" className="flex rounded-full border border-border p-0.5 shrink-0">
            {[
              [false, "Detail"],
              [true, "Bucket"],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={useBuckets === value}
                onClick={() => {
                  if (useBuckets === value) return;
                  setUseBuckets(value);
                  setSelectedCategoryFilters([]);
                  setTravelDrillBucketId(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${useBuckets === value ? "bg-ledger text-white" : "text-ink-muted hover:text-ink"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <span className="block text-xs text-ink-muted mb-0.5">From</span>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
              monthAriaLabel="From month"
              yearAriaLabel="From year"
            />
          </div>
          <div>
            <span className="block text-xs text-ink-muted mb-0.5">To</span>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              format="MM/yyyy"
              clearIcon={null}
              maxDetail="month"
              monthAriaLabel="To month"
              yearAriaLabel="To year"
            />
          </div>

          <div role="group" aria-label="Date presets" className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => {
              const [from, to] = preset.range(new Date());
              const active = sameMonth(fromDate, from) && sameMonth(toDate, to);
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFromDate(from);
                    setToDate(to);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-ledger text-white border-ledger" : "border-border text-ink-muted hover:border-ledger hover:text-ledger-dark"
                    }`}
                >
                  {preset.label}
                </button>
              );
            })}
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

            <button
              onClick={() => {
                setTravelDrillBucketId(null);
                setSelectedCategoryFilters([]);
                setSelectedBucketIds((prev) =>
                  prev.includes(TRAVEL_FILTER_ID) ? prev.filter((x) => x !== TRAVEL_FILTER_ID) : [TRAVEL_FILTER_ID]
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
        <>
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
          <div className="bg-surface border border-border rounded-lg p-4 sm:p-6 flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col items-center min-w-0">
              <ExpensePieChart data={chartData} legend={false} />
              {excludedFromPie > 0.005 && (
                <p className="text-xs text-ink-muted mt-2">
                  Refunds/credits of {formatCurrencyPrecise(excludedFromPie)} aren't shown in the chart but are included in Total Expenses.
                </p>
              )}
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
            </div>
          </div>

          {/* MONTHLY TREND */}
          {monthlyTotals.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-6">
              <h3 className="text-base font-semibold mb-3 text-ink">Monthly Spending</h3>
              <MonthlySpendChart data={monthlyTotals} />
            </div>
          )}
        </>
      ) : (
        <p className="text-ink-muted text-center py-10">No expenses match the current filters.</p>
      )}
    </div>
  );
}
