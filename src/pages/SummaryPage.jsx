import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { ALL_MONTHS, formatDate } from "../utils/dateHelpers";
import { daysSinceLastReconciliation } from "../utils/balanceHelpers";
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

  const lastMonthTx = useMemo(
    () =>
      allTransactions.filter(
        (t) => t.yearNumber === lastMonthDate.getFullYear() && t.monthName === ALL_MONTHS[lastMonthDate.getMonth()]
      ),
    [allTransactions, lastMonthDate]
  );

  // -------------------------
  // Income/Expense monthly rollup - feeds both summary cards and the trend
  // chart, computed once here rather than per-component.
  // -------------------------
  const monthlyRows = useMemo(
    () => buildMonthlyIncomeExpense(allTransactions, balanceEntries),
    [allTransactions, balanceEntries]
  );

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

  const transactionCount = thisMonthTx.length;
  const transactionCountDelta = transactionCount - lastMonthTx.length;

  const daysLeftInMonth = useMemo(() => {
    const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
    return daysInMonth - today.getDate();
  }, [currentYear, today]);

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
        <div className="h-[320px]">
          <IncomeExpenseChart data={monthlyRows} />
        </div>
        <div className="h-[320px]">
          <QuickStatsPanel
            savingsRatePct={savingsRatePct}
            largestExpense={largestExpense}
            topCategory={topCategory}
            transactionCount={transactionCount}
            transactionCountDelta={transactionCountDelta}
            daysLeftInMonth={daysLeftInMonth}
          />
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
