import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";

function StatRow({ label, primary, secondary, tertiary }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-4 py-2 border-b border-border last:border-b-0 min-h-0">
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
    <div className="h-full bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
      <StatRow
        label="Savings Rate"
        primary={savingsRatePct === null ? "—" : `${savingsRatePct.toFixed(1)}%`}
        secondary="of income"
      />

      <StatRow
        label="Largest Expense"
        primary={<span className="money">{largestExpense ? formatCurrency(largestExpense.amount) : "—"}</span>}
        secondary={largestExpense?.category}
        tertiary={largestExpense?.date ? formatDate(largestExpense.date) : undefined}
      />

      <StatRow
        label="Top Spending Category"
        primary={topCategory?.name || "—"}
        secondary={topCategory && <span className="money">{formatCurrency(topCategory.amount)}</span>}
        tertiary={topCategory ? `${topCategory.pct.toFixed(1)}% of total expenses` : undefined}
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
      />

      <StatRow label="Days Left in Month" primary={daysLeftInMonth} />
    </div>
  );
}
