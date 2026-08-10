import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";

function StatRow({
  label,
  primary,
  secondary,
  tertiary,
  borderRight = false,
  borderBottom = false,
  valueColor = "text-ink",
  bgColor = "",
}) {
  return (
    <div
      className={`flex flex-col justify-center px-3 py-2.5 border-border ${borderRight ? "border-r" : ""} ${
        borderBottom ? "border-b" : ""
      } ${bgColor}`}
    >
      <div className="text-[11px] text-ink-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold leading-none truncate ${valueColor}`}>{primary}</div>
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
// Status -> styling for the Next Payment Due card - overdue reads as
// urgent (alert), due soon as a warning, further out as plain/neutral
// (not "settled" the way Liabilities Due This Month's green is, since
// something IS still owed, just not urgently).
const DUE_STATUS_STYLES = {
  overdue: { valueColor: "text-alert", bgColor: "bg-alert-soft" },
  dueSoon: { valueColor: "text-warning", bgColor: "bg-warning-soft" },
  upcoming: { valueColor: "text-ink", bgColor: "" },
};

export default function QuickStatsPanel({
  savingsRatePct,
  largestExpense,
  topCategory,
  spendPace,
  liabilitiesDueThisMonth,
  nextPaymentDue,
}) {
  // Signed: positive = still owed somewhere this month (warning/amber),
  // 0 or negative = everything due this month is settled or net overpaid
  // (green) - see SummaryPage's aggregation across liabilities for what
  // feeds this. formatCurrency puts the minus sign after the currency
  // symbol for negative numbers ("₱-2,000"), so the sign is pulled out
  // front here instead for a cleaner overpaid/credit display.
  const dueAmount = liabilitiesDueThisMonth ?? 0;
  const dueDisplay =
    dueAmount < 0 ? `-${formatCurrency(Math.abs(dueAmount))}` : formatCurrency(dueAmount);
  const dueIsSettled = dueAmount <= 0;
  const dueColor = dueIsSettled ? "text-ledger-dark" : "text-warning";
  const dueBg = dueIsSettled ? "bg-ledger-soft" : "bg-warning-soft";
  const dueSecondary = dueAmount > 0 ? "Still unsettled" : dueAmount < 0 ? "Credit balance" : "Paid in full";

  // Spend Pace: projected month-end total vs last month's actual pace.
  // Higher pace = spending faster than last month (bad, alert-red), lower
  // pace = spending slower (good, ledger-green) - same sign convention as
  // ExpenseAnalytics's "vs Previous Month" card.
  const pacePct = spendPace?.paceVsLastMonthPct ?? null;
  const paceColor = pacePct > 0 ? "text-alert" : pacePct < 0 ? "text-ledger-dark" : "text-ink";

  // Next Payment Due: null means nothing currently owed anywhere - a
  // genuinely good state, styled the same green as a settled statement.
  const dueStatusStyle = nextPaymentDue
    ? DUE_STATUS_STYLES[nextPaymentDue.status]
    : { valueColor: "text-ledger-dark", bgColor: "bg-ledger-soft" };

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
        label="Spend Pace"
        primary={<span className="money">{spendPace ? formatCurrency(spendPace.projectedMonthTotal) : "—"}</span>}
        secondary="Projected total this month"
        tertiary={
          pacePct === null
            ? "No prior month to compare"
            : `${pacePct >= 0 ? "+" : ""}${pacePct.toFixed(0)}% vs last month's pace`
        }
        valueColor={paceColor}
        borderBottom
      />

      <StatRow
        label="Liabilities Due This Month"
        primary={<span className="money">{dueDisplay}</span>}
        secondary={dueSecondary}
        valueColor={dueColor}
        bgColor={dueBg}
        borderRight
      />

      <StatRow
        label="Next Payment Due"
        primary={<span className="money">{nextPaymentDue ? formatCurrency(nextPaymentDue.amount) : "—"}</span>}
        secondary={nextPaymentDue ? nextPaymentDue.accountName : "Nothing currently owed"}
        tertiary={nextDueTertiary}
        valueColor={dueStatusStyle.valueColor}
        bgColor={dueStatusStyle.bgColor}
      />
    </div>
  );
}
