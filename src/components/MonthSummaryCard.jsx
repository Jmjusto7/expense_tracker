import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatCurrency } from "../utils/formatCurrency";

// accent: "ledger" (green, for Income) or "alert" (red, for Expenses) -
// themes the whole card, value and change indicator alike.
// compact: smaller padding/type, for contexts where these shouldn't compete
// with a larger hero element above them.
export default function MonthSummaryCard({ label, value, changeAmount, changePct, accent = "ledger", compact = false }) {
  const themeColor = accent === "alert" ? "text-alert" : "text-ledger-dark";
  const ChangeIcon = changeAmount > 0 ? ArrowUpRight : changeAmount < 0 ? ArrowDownRight : Minus;

  return (
    <div className={`h-full bg-surface border border-border rounded-xl flex flex-col justify-center ${compact ? "p-4" : "p-5"}`}>
      <div className="text-xs text-ink-muted uppercase tracking-wide mb-1.5">{label}</div>
      <div
        className={`money font-display font-bold leading-none mb-1.5 ${themeColor} ${
          compact ? "text-xl" : "text-3xl"
        }`}
      >
        {formatCurrency(value)}
      </div>
      {changePct !== null ? (
        <div className={`money flex items-center gap-1 text-xs font-medium ${themeColor}`}>
          <ChangeIcon size={12} />
          {formatCurrency(Math.abs(changeAmount))} ({changeAmount >= 0 ? "+" : "-"}
          {Math.abs(changePct).toFixed(1)}%)
        </div>
      ) : (
        <div className="text-xs text-ink-muted">No prior month to compare</div>
      )}
      {!compact && <div className="text-xs text-ink-muted mt-0.5">vs last month</div>}
    </div>
  );
}
