import { Link } from "react-router-dom";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";

// Cells sit on a 1px bg-border grid gap, so borders work in any column count.
function StatRow({ label, primary, secondary, tertiary, valueColor = "text-ink", bgColor = "bg-surface", to }) {
  const content = (
    <>
      <div className="text-[11px] text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold leading-tight break-words ${valueColor}`}>{primary}</div>
      {secondary && <div className="text-xs text-ink-muted mt-1 break-words">{secondary}</div>}
      {tertiary && <div className="text-xs text-ink-muted/80 break-words">{tertiary}</div>}
    </>
  );
  const className = `flex flex-col justify-center px-3 py-2.5 min-w-0 ${bgColor}`;
  return to ? (
    <Link to={to} className={`${className} hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ledger`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

const DUE_STATUS_STYLES = {
  overdue: { valueColor: "text-alert", bgColor: "bg-alert-soft" },
  dueSoon: { valueColor: "text-warning", bgColor: "bg-warning-soft" },
  upcoming: { valueColor: "text-ink", bgColor: "bg-surface" },
};

export default function QuickStatsPanel({ savingsRatePct, largestExpense, topCategory, spendPace, liabilitiesDueThisMonth, nextPaymentDue }) {
  // Positive = still owed this month; 0/negative = settled or net credit.
  const dueAmount = liabilitiesDueThisMonth ?? 0;
  const dueIsSettled = dueAmount <= 0;
  const dueSecondary = dueAmount > 0 ? "Still unsettled" : dueAmount < 0 ? "Credit balance" : "Paid in full";

  // Faster than last month's pace reads as bad (red), slower as good (green).
  const pacePct = spendPace?.paceVsLastMonthPct ?? null;
  const paceColor = pacePct > 0 ? "text-alert" : pacePct < 0 ? "text-ledger-dark" : "text-ink";

  const dueStatusStyle = nextPaymentDue ? DUE_STATUS_STYLES[nextPaymentDue.status] : { valueColor: "text-ledger-dark", bgColor: "bg-ledger-soft" };

  const nextDueTertiary = !nextPaymentDue
    ? undefined
    : nextPaymentDue.status === "overdue"
      ? `${Math.abs(nextPaymentDue.daysUntilDue)} day${Math.abs(nextPaymentDue.daysUntilDue) === 1 ? "" : "s"} overdue`
      : nextPaymentDue.daysUntilDue === 0
        ? "Due today"
        : nextPaymentDue.daysUntilDue <= 7
          ? `Due in ${nextPaymentDue.daysUntilDue} day${nextPaymentDue.daysUntilDue === 1 ? "" : "s"}`
          : `Due ${formatDate(nextPaymentDue.dueDate)}`;

  return (
    <div className="flex-1 bg-border border border-border rounded-xl overflow-hidden grid grid-cols-1 min-[360px]:grid-cols-2 gap-px">
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
        label="Top Category"
        primary={topCategory?.name || "—"}
        secondary={topCategory && <span className="money">{formatCurrency(topCategory.amount)}</span>}
        tertiary={topCategory ? `${topCategory.pct.toFixed(1)}% of expenses` : undefined}
      />

      <StatRow
        label="Spend Pace"
        primary={<span className="money">{spendPace ? formatCurrency(spendPace.projectedMonthTotal) : "—"}</span>}
        secondary="Projected month total"
        tertiary={pacePct === null ? "No prior month to compare" : `${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(0)}% vs last month`}
        valueColor={paceColor}
      />

      <StatRow
        label="Due This Month"
        primary={<span className="money">{formatCurrency(dueAmount)}</span>}
        secondary={dueSecondary}
        valueColor={dueIsSettled ? "text-ledger-dark" : "text-warning"}
        bgColor={dueIsSettled ? "bg-ledger-soft" : "bg-warning-soft"}
        to="/liabilities"
      />

      <StatRow
        label="Next Payment Due"
        primary={<span className="money">{nextPaymentDue ? formatCurrency(nextPaymentDue.amount) : "—"}</span>}
        secondary={nextPaymentDue ? nextPaymentDue.accountName : "Nothing currently owed"}
        tertiary={nextDueTertiary}
        valueColor={dueStatusStyle.valueColor}
        bgColor={dueStatusStyle.bgColor}
        to={nextPaymentDue ? `/liabilities/${nextPaymentDue.accountId}` : undefined}
      />
    </div>
  );
}
