import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { ALL_MONTHS, formatDate } from "../utils/dateHelpers";
import { daysSinceLastReconciliation, getStatementInfo } from "../utils/balanceHelpers";
import { buildMonthlyIncomeExpense, findMonthRow } from "../utils/incomeExpenseHelpers";
import NetWorthHeroCard from "../components/NetWorthHeroCard";
import MonthSummaryCard from "../components/MonthSummaryCard";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import QuickStatsPanel from "../components/QuickStatsPanel";

// An account is treated as "needing attention" once its reconciliation is
// more than 30 days stale (or it has none at all) - the one real thing
// this dashboard has to notify about, rather than a decorative bell.
const STALE_RECONCILIATION_DAYS = 30;

const SummaryPage = () => {
  const navigate = useNavigate();
  const { allTransactions, accounts, balanceEntries } = useExpenseContext();

  const today = new Date();
  const currentMonthName = ALL_MONTHS[today.getMonth()];
  const currentYear = today.getFullYear();
  const lastMonthDate = new Date(currentYear, today.getMonth() - 1, 1);

  // -------------------------
  // This month / last month transaction slices - the base data for the
  // monthly cards and most of Quick Stats.
  // -------------------------
  const thisMonthTx = useMemo(
    () => allTransactions.filter((t) => t.yearNumber === currentYear && t.monthName === currentMonthName),
    [allTransactions, currentYear, currentMonthName]
  );

  // -------------------------
  // Income/Expense monthly rollup - feeds both summary cards and the trend
  // chart, computed once here rather than per-component.
  // -------------------------
  const monthlyRows = useMemo(
    () => buildMonthlyIncomeExpense(allTransactions, balanceEntries),
    [allTransactions, balanceEntries]
  );

  // Trailing 12 calendar months (including the current one) - the chart
  // otherwise plots every month of history ever logged, which grows
  // increasingly illegible as more years accumulate. Mirrors the same
  // 12-month window trailing12MonthGap already uses for the Gap Trend stat,
  // just applied here to the chart's own data instead of a single sum.
  const last12MonthsRows = useMemo(() => {
    const endTs = new Date(currentYear, today.getMonth(), 1).getTime();
    const startTs = new Date(currentYear, today.getMonth() - 11, 1).getTime();
    return monthlyRows.filter((r) => r.date.getTime() >= startTs && r.date.getTime() <= endTs);
  }, [monthlyRows, currentYear, today]);

  const thisMonthRow = findMonthRow(monthlyRows, currentYear, today.getMonth());
  const lastMonthRow = findMonthRow(monthlyRows, lastMonthDate.getFullYear(), lastMonthDate.getMonth());

  const thisMonthIncome = thisMonthRow?.income ?? 0;
  const thisMonthExpense = thisMonthRow?.expense ?? 0;

  const incomeChangeAmount = thisMonthIncome - (lastMonthRow?.income ?? 0);
  const incomeChangePct = lastMonthRow?.income ? (incomeChangeAmount / lastMonthRow.income) * 100 : null;

  const expenseChangeAmount = thisMonthExpense - (lastMonthRow?.expense ?? 0);
  const expenseChangePct = lastMonthRow?.expense ? (expenseChangeAmount / lastMonthRow.expense) * 100 : null;

  // -------------------------
  // Quick Stats
  // -------------------------
  const savingsRatePct =
    thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100 : null;

  const largestExpense = useMemo(() => {
    if (thisMonthTx.length === 0) return null;
    const top = [...thisMonthTx].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
    return {
      amount: Number(top.amount || 0),
      category: top.category,
      date: new Date(top.yearNumber, ALL_MONTHS.indexOf(top.monthName), top.dayNumber),
    };
  }, [thisMonthTx]);

  const topCategory = useMemo(() => {
    if (thisMonthTx.length === 0) return null;
    const totals = {};
    thisMonthTx.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount || 0);
    });
    const totalExpense = Object.values(totals).reduce((s, v) => s + v, 0);
    const [name, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    return { name, amount, pct: totalExpense ? (amount / totalExpense) * 100 : 0 };
  }, [thisMonthTx]);

  // Projects this month's likely total from the daily average so far, then
  // compares that projection to last month's actual pace - the one
  // forward-looking figure on this dashboard, versus everything else here
  // which reports what already happened. Positive pct = spending faster
  // than last month; negative = slower.
  const daysElapsedThisMonth = today.getDate();
  const daysInThisMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();

  const spendPace = useMemo(() => {
    if (daysElapsedThisMonth <= 0) return null;
    const projectedMonthTotal = (thisMonthExpense / daysElapsedThisMonth) * daysInThisMonth;
    const paceVsLastMonthPct = lastMonthRow?.expense
      ? ((projectedMonthTotal - lastMonthRow.expense) / lastMonthRow.expense) * 100
      : null;
    return { projectedMonthTotal, paceVsLastMonthPct };
  }, [thisMonthExpense, daysElapsedThisMonth, daysInThisMonth, lastMonthRow]);

  // Sum of remainingDue (see getStatementInfo/getStatementPaymentStatus)
  // across every liability whose most recent statement's due date falls
  // in the current calendar month - one signed figure: positive = still
  // owed somewhere this month, 0 = everything due this month is settled,
  // negative = net overpaid/credit across what's due this month. A
  // liability with no statement logged yet (no due date at all) doesn't
  // contribute - there's nothing to be "due" without a real cutoff.
  const liabilitiesDueThisMonth = useMemo(() => {
    return accounts
      .filter((a) => a.isLiability)
      .reduce((sum, a) => {
        const info = getStatementInfo(balanceEntries, a, today);
        if (!info.dueDate) return sum;
        const isDueThisMonth =
          info.dueDate.getFullYear() === currentYear && info.dueDate.getMonth() === today.getMonth();
        return isDueThisMonth ? sum + (info.remainingDue ?? 0) : sum;
      }, 0);
  }, [accounts, balanceEntries, currentYear, today]);

  // The single soonest unpaid due date across ALL liabilities, regardless
  // of calendar month - liabilitiesDueThisMonth above only sums what's due
  // within the current month, so something due a few days into next month
  // would otherwise never surface here until the month actually flips.
  const NEXT_DUE_SOON_DAYS = 7;

  const nextPaymentDue = useMemo(() => {
    const candidates = accounts
      .filter((a) => a.isLiability)
      .map((a) => ({ account: a, info: getStatementInfo(balanceEntries, a, today) }))
      .filter(({ info }) => info.dueDate && (info.remainingDue ?? 0) > 0)
      .sort((a, b) => a.info.dueDate - b.info.dueDate);

    if (candidates.length === 0) return null;

    const { account, info } = candidates[0];
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueMidnight = new Date(info.dueDate.getFullYear(), info.dueDate.getMonth(), info.dueDate.getDate());
    const daysUntilDue = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    const status =
      daysUntilDue < 0 ? "overdue" : daysUntilDue <= NEXT_DUE_SOON_DAYS ? "dueSoon" : "upcoming";

    return {
      accountName: account.name,
      amount: info.remainingDue,
      dueDate: info.dueDate,
      daysUntilDue,
      status,
    };
  }, [accounts, balanceEntries, today]);

  // -------------------------
  // Notification bell - accounts overdue for reconciliation, the one
  // genuine thing this dashboard has to flag.
  // -------------------------
  const staleAccountCount = useMemo(() => {
    return accounts.filter((a) => {
      const days = daysSinceLastReconciliation(balanceEntries, a.id);
      return days === null || days > STALE_RECONCILIATION_DAYS;
    }).length;
  }, [accounts, balanceEntries]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-4">
      {/* Notification bell only - no greeting text */}
      <div className="shrink-0 flex items-center justify-end">
        <button
          onClick={() => navigate("/assets")}
          className="relative p-2 rounded-full text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
          title={
            staleAccountCount > 0
              ? `${staleAccountCount} account${staleAccountCount === 1 ? "" : "s"} need reconciling`
              : "All accounts reconciled recently"
          }
        >
          <Bell size={20} />
          {staleAccountCount > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-alert text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {staleAccountCount}
            </span>
          )}
        </button>
      </div>

      {/* NET WORTH HERO */}
      <div className="h-[280px] shrink-0">
        <NetWorthHeroCard accounts={accounts} balanceEntries={balanceEntries} />
      </div>

      {/* MONTHLY SUMMARY CARDS - smaller than the hero, side by side */}
      <div className="grid grid-cols-2 gap-4">
        <MonthSummaryCard
          label="This Month's Income"
          value={thisMonthIncome}
          changeAmount={incomeChangeAmount}
          changePct={incomeChangePct}
          accent="ledger"
          compact
        />
        <MonthSummaryCard
          label="This Month's Expenses"
          value={thisMonthExpense}
          changeAmount={expenseChangeAmount}
          changePct={expenseChangePct}
          accent="alert"
          compact
        />
      </div>

      {/* BOTTOM: TREND CHART (reusing the Assets-tab chart) + QUICK STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="h-[300px]">
          <IncomeExpenseChart data={last12MonthsRows} />
        </div>
        <div className="h-[300px]">
          <QuickStatsPanel
            savingsRatePct={savingsRatePct}
            largestExpense={largestExpense}
            topCategory={topCategory}
            spendPace={spendPace}
            liabilitiesDueThisMonth={liabilitiesDueThisMonth}
            nextPaymentDue={nextPaymentDue}
          />
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
