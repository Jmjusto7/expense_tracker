import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useExpenseContext } from "../../context/ExpenseContext";
import { useBucketsWithCategoriesState } from "../../hooks/useBucketsWithCategories";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { ALL_MONTHS } from "../../utils/dateHelpers";
import { compactCurrency } from "../../utils/chartFormat";
import BucketBoard from "./bucketing/BucketBoard";
import BucketCards from "./bucketing/BucketCards";

const inputClass =
  "border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none";

// Each category belongs to at most one bucket. Board (drag & drop) on wide screens, cards on phones.
const CategoryBucketing = () => {
  const { addBucket, renameBucket, setBucketIcon, removeBucket, assignToBucket, cleanBucketAssignments, categories = [], allTransactions = [] } =
    useExpenseContext();
  const { buckets, loaded } = useBucketsWithCategoriesState();
  const wide = useMediaQuery("(min-width: 768px)");
  const [newBucket, setNewBucket] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    cleanBucketAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bucketOf = useMemo(() => {
    const map = new Map();
    for (const b of buckets) for (const c of b.categories || []) map.set(c, b.id);
    return map;
  }, [buckets]);

  const columns = useMemo(() => {
    const sorted = (list) => [...list].sort((a, b) => a.localeCompare(b));
    return [
      { id: null, name: "Unassigned", categories: sorted(categories.filter((c) => !bucketOf.has(c))) },
      ...buckets.map((b) => ({ ...b, categories: sorted((b.categories || []).filter((c) => categories.includes(c))) })),
    ];
  }, [buckets, categories, bucketOf]);

  const monthSpend = useMemo(() => {
    const now = new Date();
    const totals = new Map();
    for (const t of allTransactions) {
      if (t.yearNumber !== now.getFullYear() || t.monthName !== ALL_MONTHS[now.getMonth()]) continue;
      totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount || 0));
    }
    return totals;
  }, [allTransactions]);

  const metaFor = (col) => {
    const spend = col.categories.reduce((sum, c) => sum + (monthSpend.get(c) ?? 0), 0);
    return `${col.categories.length} categor${col.categories.length === 1 ? "y" : "ies"}${spend ? ` · ${compactCurrency(spend)} this month` : ""}`;
  };

  const move = async (category, targetId) => {
    const current = bucketOf.get(category);
    if (targetId === null) {
      if (current != null) await assignToBucket(current, category);
    } else if (current !== targetId) {
      await assignToBucket(targetId, category);
    }
  };

  const handleAddBucket = async (e) => {
    e.preventDefault();
    if (!newBucket.trim()) return;
    await addBucket(newBucket.trim());
    setNewBucket("");
  };

  const View = wide ? BucketBoard : BucketCards;

  return (
    <div>
      <p className="text-sm text-ink-muted mb-4">
        Buckets group categories for analytics. Each category can be in one bucket. Tap a bucket's icon to pick an emoji - it shows on that bucket's expenses.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <form className="flex gap-2 flex-1" onSubmit={handleAddBucket}>
          <input
            value={newBucket}
            onChange={(e) => setNewBucket(e.target.value)}
            placeholder="New bucket name"
            aria-label="New bucket name"
            className={`${inputClass} flex-1 min-w-0`}
          />
          <button
            type="submit"
            className="flex items-center gap-1 bg-ledger hover:bg-ledger-dark text-white px-3 py-2 rounded-md text-sm font-medium shrink-0"
          >
            <Plus size={15} aria-hidden="true" />
            New bucket
          </button>
        </form>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories"
          aria-label="Search categories"
          className={`${inputClass} sm:w-56`}
        />
      </div>

      {!loaded ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading…
        </p>
      ) : categories.length === 0 && buckets.length === 0 ? (
        <p className="text-sm text-ink-muted">No categories yet - they appear once you log transactions.</p>
      ) : (
        <View
          columns={columns}
          query={query}
          onMove={move}
          onRename={renameBucket}
          onIcon={setBucketIcon}
          onRemove={removeBucket}
          metaFor={metaFor}
        />
      )}
    </div>
  );
};

export default CategoryBucketing;
