import { X } from "lucide-react";
import { useFilter } from "../context/FilterContext";
import { formatMonthYear } from "../utils/dateHelpers";
import { TRAVEL_FILTER_ID } from "../utils/travelHelpers";

function Chip({ children, onRemove, accent = "ledger" }) {
  const styles =
    accent === "travel"
      ? "bg-travel-soft text-travel-dark border-travel/30"
      : accent === "neutral"
        ? "bg-surface-sunken text-ink-muted border-border"
        : "bg-ledger-soft text-ledger-dark border-ledger/30";

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${styles}`}>
      {children}
      <button onClick={onRemove} className="hover:opacity-70" title="Remove filter">
        <X size={12} />
      </button>
    </span>
  );
}

// Drop into any Expenses page to show the filter set on the Expenses tab
// (ExpenseAnalytics is where filters get set; this shows/removes them).
// Renders nothing when no filter is active.
export default function FilterBar() {
  const {
    buckets,
    fromDate,
    toDate,
    selectedBucketIds,
    selectedCategoryFilters,
    travelDrillBucketId,
    hasActiveFilters,
    clearFilters,
    clearDateRange,
    removeBucketFilter,
    removeCategoryFilter,
    removeTravelDrillBucket,
  } = useFilter();

  if (!hasActiveFilters) return null;

  const dateLabel = fromDate && toDate
    ? `${formatMonthYear(fromDate)} – ${formatMonthYear(toDate)}`
    : fromDate
      ? `From ${formatMonthYear(fromDate)}`
      : toDate
        ? `Until ${formatMonthYear(toDate)}`
        : null;

  // Find the drill bucket name for display
  const travelDrillBucketName = travelDrillBucketId
    ? buckets.find((b) => b.id === travelDrillBucketId)?.name
    : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-6 bg-surface border border-border rounded-lg px-3 py-2">
      <span className="text-xs text-ink-muted mr-0.5">Filtered:</span>

      {dateLabel && (
        <Chip accent="neutral" onRemove={clearDateRange}>
          {dateLabel}
        </Chip>
      )}

      {selectedBucketIds.map((id) =>
        id === TRAVEL_FILTER_ID ? (
          <Chip key={id} accent="travel" onRemove={() => removeBucketFilter(id)}>
            ✈ Travel
          </Chip>
        ) : (
          <Chip key={id} accent="ledger" onRemove={() => removeBucketFilter(id)}>
            {buckets.find((b) => b.id === id)?.name || "Bucket"}
          </Chip>
        )
      )}

      {/* Travel drill-down bucket (Travel -> Bucket level) */}
      {travelDrillBucketName && (
        <Chip accent="travel" onRemove={removeTravelDrillBucket}>
          → {travelDrillBucketName}
        </Chip>
      )}

      {selectedCategoryFilters.map((cat) => (
        <Chip key={cat} accent="ledger" onRemove={() => removeCategoryFilter(cat)}>
          {cat}
        </Chip>
      ))}

      <button
        onClick={clearFilters}
        className="text-xs text-ink-muted hover:text-ink underline underline-offset-2 ml-auto"
      >
        Clear all
      </button>
    </div>
  );
}
