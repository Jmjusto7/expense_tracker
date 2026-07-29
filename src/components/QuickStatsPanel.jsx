import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";

function StatRow({ label, primary, secondary, tertiary, borderRight = false, borderBottom = false }) {
  return (
    <div
      className={`flex flex-col justify-center px-3 py-2.5 border-border ${borderRight ? "border-r" : ""} ${
        borderBottom ? "border-b" : ""
      }`}
    >
      <div className="text-[11px] text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-ink leading-none truncate">{primary}</div>
      {secondary && <div className="text-xs text-ink-muted mt-1 truncate">{secondary}</div>}
      {tertiary && <div className="text-xs text-ink-muted/70 truncate">{tertiary}</div>}
    </div>
  );
}

// Each row's "primary" (headline) figure is whichever the brief treats as
// the headline for that stat - amount for Largest Expense, but the
// category NAME for Top Spending Category (that one answers "which
// category", not "how much") - so these are deliberately not templated
// identically to each other.
export default function QuickStatsPanel({
  savingsRatePct,
  largestExpense,
  topCategory,
  transactionCount,
  transactionCountDelta,
  daysLeftInMonth,
}) {
  return (
    <div className="h-full bg-surface border border-border rounded-xl grid grid-cols-2 overflow-y-auto">
      <StatRow
        label="Savings Rate"
        primary={savingsRatePct === null ? "—" : `${savingsRatePct.toFixed(1)}%`}
        secondary="of income"
        borderRight
        borderBottom
      />

      <StatRow
        label="Largest Expense"
        primary={<span className="money">{largestExpense ? formatCurrency(largestExpense.amount) : "—"}</span>}
        secondary={largestExpense?.category}
        tertiary={largestExpense?.date ? formatDate(largestExpense.date) : undefined}
        borderBottom
      />

      <StatRow
        label="Top Spending Category"
        primary={topCategory?.name || "—"}
        secondary={topCategory && <span className="money">{formatCurrency(topCategory.amount)}</span>}
        tertiary={topCategory ? `${topCategory.pct.toFixed(1)}% of total expenses` : undefined}
        borderRight
        borderBottom
      />

      <StatRow
        label="Transactions"
        primary={transactionCount.toLocaleString()}
        secondary="This Month"
        tertiary={
          transactionCountDelta === null
            ? undefined
            : `${transactionCountDelta >= 0 ? "+" : ""}${transactionCountDelta} vs last month`
        }
        borderBottom
      />

      <StatRow label="Days Left in Month" primary={daysLeftInMonth} />
    </div>
  );
}
