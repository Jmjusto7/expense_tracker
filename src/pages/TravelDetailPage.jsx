import { useParams, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useExpenseContext } from "../context/ExpenseContext";
import { ArrowLeft, Plane, ChevronRight, X } from "lucide-react";
import { formatDate } from "../utils/dateHelpers";
import { formatCurrency, formatCurrencyPrecise } from "../utils/formatCurrency";
import { filterTransactionsByTravel, sumAmounts, findTravelById } from "../utils/travelHelpers";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import ExpensePieChart from "../components/ExpensePieChart";
import BreakdownGrid from "../components/BreakdownGrid";

export default function TravelDetailPage() {
  const { travelId } = useParams();
  const { travels, allTransactions } = useExpenseContext();
  const buckets = useBucketsWithCategories();

  const travel = findTravelById(travels, travelId);
  const transactions = filterTransactionsByTravel(allTransactions, travelId);
  const total = sumAmounts(transactions);

  // -------------------------
  // Drill-down state: null = bucket level. Once a bucket is picked,
  // drills to that bucket's categories (for this travel only). A
  // category can then be picked to narrow the transaction table below.
  // -------------------------
  const [drillBucketId, setDrillBucketId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const drillBucket = buckets.find((b) => b.id === drillBucketId) || null;

  // -------------------------
  // Level 1: spend by bucket, for this travel's transactions only
  // -------------------------
  const bucketLevelData = useMemo(() => {
    const bucketedCategories = new Set(buckets.flatMap((b) => b.categories));

    const result = buckets.reduce((acc, b) => {
      const amt = transactions
        .filter((t) => b.categories.includes(t.category))
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      if (amt > 0) acc.push({ category: b.name, amount: amt, bucketId: b.id });
      return acc;
    }, []);

    const unassignedAmt = transactions
      .filter((t) => t.category && !bucketedCategories.has(t.category))
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    if (unassignedAmt > 0) {
      result.push({ category: "Unassigned", amount: unassignedAmt, bucketId: null });
    }

    const sum = result.reduce((s, x) => s + x.amount, 0);
    return result.map((x) => ({
      ...x,
      percent: sum ? ((x.amount / sum) * 100).toFixed(1) : 0,
    }));
  }, [transactions, buckets]);

  // -------------------------
  // Level 2: spend by category, scoped to the drilled-into bucket
  // -------------------------
  const categoryLevelData = useMemo(() => {
    if (!drillBucket) return [];

    const map = {};
    transactions
      .filter((t) => drillBucket.categories.includes(t.category))
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount || 0);
      });

    const sum = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
      percent: sum ? ((amount / sum) * 100).toFixed(1) : 0,
    }));
  }, [transactions, drillBucket]);

  const currentLevelData = drillBucket ? categoryLevelData : bucketLevelData;

  // -------------------------
  // Breakdown grid wiring
  // -------------------------
  const breakdownItems = useMemo(() => {
    return [...currentLevelData]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        key: drillBucket ? item.category : item.bucketId ?? "unassigned",
        label: item.category,
        amountDisplay: formatCurrencyPrecise(item.amount),
        percent: item.percent,
        disabled: !drillBucket && item.bucketId == null,
        bucketId: item.bucketId,
        category: item.category,
      }));
  }, [currentLevelData, drillBucket]);

  const handleBreakdownClick = (item) => {
    if (drillBucket) {
      setSelectedCategory((prev) => (prev === item.category ? null : item.category));
    } else {
      setDrillBucketId(item.bucketId);
      setSelectedCategory(null);
    }
  };

  const activeKeys = drillBucket && selectedCategory ? [selectedCategory] : [];

  // -------------------------
  // Transaction table scope follows the current drill-down
  // -------------------------
  const visibleTransactions = useMemo(() => {
    if (selectedCategory) return transactions.filter((t) => t.category === selectedCategory);
    if (drillBucket) return transactions.filter((t) => drillBucket.categories.includes(t.category));
    return transactions;
  }, [transactions, drillBucket, selectedCategory]);

  const resetDrill = () => {
    setDrillBucketId(null);
    setSelectedCategory(null);
  };

  if (!travel) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-alert">Travel not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/travels"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} />
        All travels
      </Link>

      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2">
          <Plane size={18} className="text-travel-dark" />
          <h1 className="font-display text-2xl text-ink">
            {travel.title}
          </h1>
        </div>

        <div className="text-ink-muted mt-1">
          {formatDate(travel.startDate)} – {formatDate(travel.endDate)}
        </div>

        <div className="money text-2xl font-bold text-travel-dark mt-3">
          {formatCurrency(total)}
        </div>
      </div>

      {/* Bucket / Category Drill-down */}
      {currentLevelData.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6 mb-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm mb-4">
            <button
              onClick={resetDrill}
              className={drillBucket ? "text-ink-muted hover:text-ink" : "font-semibold text-ink"}
            >
              Spending by Bucket
            </button>
            {drillBucket && (
              <>
                <ChevronRight size={14} className="text-ink-muted" />
                <span className="font-semibold text-ink">{drillBucket.name}</span>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col items-center">
              <ExpensePieChart data={currentLevelData} />
            </div>

            <div className="flex-[0.8] flex flex-col gap-2">
              <div className="text-xs text-ink-muted uppercase tracking-wide">
                {drillBucket ? "Click a category to filter transactions" : "Click a bucket to drill in"}
              </div>
              <BreakdownGrid
                items={breakdownItems}
                activeKeys={activeKeys}
                onItemClick={handleBreakdownClick}
                accent="travel"
              />
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-surface rounded-lg border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink">
            Transactions
            {selectedCategory && (
              <span className="text-ink-muted font-normal"> — {selectedCategory}</span>
            )}
            {!selectedCategory && drillBucket && (
              <span className="text-ink-muted font-normal"> — {drillBucket.name}</span>
            )}
          </h2>

          {(drillBucket || selectedCategory) && (
            <button
              onClick={resetDrill}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
              <th className="border border-border px-3 py-2 font-medium">Date</th>
              <th className="border border-border px-3 py-2 font-medium">Category</th>
              <th className="border border-border px-3 py-2 font-medium">Comments</th>
              <th className="border border-border px-3 py-2 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleTransactions.map((t) => (
              <tr key={t.id}>
                <td className="border border-border px-3 py-2 text-ink-muted">
                  {t.monthName} {t.dayNumber}, {t.yearNumber}
                </td>
                <td className="border border-border px-3 py-2 text-ink">
                  {t.category}
                </td>
                <td className="border border-border px-3 py-2 text-ink-muted">
                  {t.comments}
                </td>
                <td className="money border border-border px-3 py-2 text-right font-semibold text-travel-dark">
                  {formatCurrency(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibleTransactions.length === 0 && (
          <p className="text-ink-muted text-sm text-center py-6">No transactions in this scope.</p>
        )}
      </div>
    </div>
  );
}
