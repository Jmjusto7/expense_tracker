import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";

// accent: "ledger" (green, for Income) or "alert" (red, for Expenses) -
// themes the whole card, value and change indicator alike.
export default function MonthSummaryCard({ label, value, changeAmount, changePct, accent = "ledger" }) {
  const themeColor = accent === "alert" ? "text-alert" : "text-ledger-dark";
  const ChangeIcon = changeAmount > 0 ? ArrowUpRight : changeAmount < 0 ? ArrowDownRight : Minus;

  return (
    <div className="h-full bg-surface border border-border rounded-xl p-5 flex flex-col justify-center">
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-2">{label}</div>
      <div className={`money font-display text-3xl font-bold leading-none mb-2 ${themeColor}`}>
        {formatCurrency(value)}
      </div>
      {changePct !== null ? (
        <div className={`money flex items-center gap-1 text-sm font-medium ${themeColor}`}>
          <ChangeIcon size={14} />
          {formatCurrency(Math.abs(changeAmount))} ({changeAmount >= 0 ? "+" : "-"}
          {Math.abs(changePct).toFixed(1)}%)
        </div>
      ) : (
        <div className="text-xs text-ink-muted">No prior month to compare</div>
      )}
      <div className="text-xs text-ink-muted mt-0.5">vs last month</div>
    </div>
  );
}
