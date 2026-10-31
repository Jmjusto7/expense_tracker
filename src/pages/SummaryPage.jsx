import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, Plus, Wallet, Cloud } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import { ALL_MONTHS } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { getAttentionItems, getUpcomingLiabilityEvents } from "../utils/attention";
import { buildMonthlyIncomeExpense, findMonthRow } from "../utils/incomeExpenseHelpers";
import { classifyTransactions, groupByEffectiveBucket } from "../utils/transactionClassification";
import NetWorthHeroCard from "../components/NetWorthHeroCard";
import MonthSummaryCard from "../components/MonthSummaryCard";
import LabelledStackBar from "../components/LabelledStackBar";
import AddTransactionModal from "../components/AddTransactionModal";
import InstallBanner from "../components/InstallBanner";

const COMING_UP_DAYS = 14;
const EVENT_BADGES = {
  overdue: "bg-alert-soft text-alert",
  paid: "bg-ledger-soft text-ledger-dark",
};

function StatTile({ label, value, sub, title }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 min-w-0" title={title}>
      <div className="text-[10px] sm:text-[11px] text-ink-muted uppercase tracking-wide leading-tight">{label}</div>
      <div className="text-base sm:text-xl font-bold text-ink leading-tight mt-1 break-words">{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function ComingUp({ events }) {
  return (
    <section aria-labelledby="coming-up-title" className="bg-surface border border-border rounded-xl p-4 h-full">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h2 id="coming-up-title" className="text-sm font-semibold text-ink">
          Coming up
        </h2>
        <span className="text-xs text-ink-muted">Next {COMING_UP_DAYS} days</span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted py-2">No card payments or statement closes coming up.</p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => {
            const d = new Date(e.date);
            return (
              <li key={e.key}>
                <Link to={`/liabilities/${e.account.id}`} className="flex items-center gap-3 py-2 hover:bg-surface-sunken -mx-2 px-2 rounded-lg">
                  <span className="w-11 shrink-0 text-center border border-border rounded-lg py-0.5" aria-hidden="true">
                    <span className="block text-base font-bold leading-tight text-ink">{d.getDate()}</span>
                    <span className="block text-[10px] uppercase text-ink-muted">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{e.account.name}</span>
                    <span className="block text-xs text-ink-muted">
                      <span className="sr-only">{d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}: </span>
                      {e.kind === "due" ? "Payment due" : e.status === "overdue" ? "Statement closed - log it" : "Statement closes"}
                    </span>
                  </span>
                  {e.kind === "due" && e.status !== "upcoming" && (
                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${EVENT_BADGES[e.status]}`}>
                      {e.status === "overdue" ? "Overdue" : "Paid ✓"}
                    </span>
                  )}
                  {e.amount != null && <span className="money text-sm font-semibold text-ink shrink-0">{formatCurrency(e.amount)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-4 animate-pulse">
      <span className="sr-only">Loading your data…</span>
      <div className="h-48 rounded-xl bg-surface-sunken" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-xl bg-surface-sunken" />
        <div className="h-24 rounded-xl bg-surface-sunken" />
      </div>
      <div className="h-64 rounded-xl bg-surface-sunken" />
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const steps = [
    {
      icon: Wallet,
      title: "Add your accounts",
      text: "Bank accounts, cash, cards - their balances make up your net worth.",
      action: (
        <Link to="/assets" className="text-sm font-medium text-ledger-dark hover:underline">
          Go to Assets
        </Link>
      ),
    },
    {
      icon: Plus,
      title: "Log an expense",
      text: "One entry per category per day; amounts can be several parts like 120, 45.",
      action: (
        <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-ledger-dark hover:underline">
          Add a transaction
        </button>
      ),
    },
    {
      icon: Cloud,
      title: "Back it up (optional)",
      text: "Connect Google Drive in Settings to sync between your phone and computer.",
      action: (
        <Link to="/settings" className="text-sm font-medium text-ledger-dark hover:underline">
          Open Settings
        </Link>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl text-ink mb-2">Welcome</h1>
      <p className="text-ink-muted mb-6">Everything stays on this device unless you turn on sync. Three steps to get going:</p>
      <ol className="flex flex-col gap-3">
        {steps.map(({ icon, title, text, action }, i) => {
          const Icon = icon;
          return (
            <li key={title} className="bg-surface border border-border rounded-xl p-4 flex gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-ledger-soft text-ledger-dark flex items-center justify-center">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-ink">
                  {i + 1}. {title}
                </div>
                <p className="text-sm text-ink-muted mb-1">{text}</p>
                {action}
              </div>
            </li>
          );
        })}
      </ol>
      {adding && (
        <AddTransactionModal
          onClose={() => setAdding(false)}
          onSaved={({ year, monthName }) => navigate(`/expenses/${year}/${monthName}`)}
        />
      )}
    </div>
  );
}

function AttentionPanel({ items }) {
  const [open, setOpen] = useState(false);
  const alertCount = items.filter((i) => i.severity === "alert").length;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="attention-list"
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
      >
        <Bell size={18} aria-hidden="true" />
        {items.length === 0 ? "All caught up" : `${items.length} need${items.length === 1 ? "s" : ""} attention`}
        {items.length > 0 && (
          <span
            className={`text-white text-[10px] leading-none rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${alertCount ? "bg-alert" : "bg-warning"
              }`}
            aria-hidden="true"
          >
            {items.length}
          </span>
        )}
      </button>
      {open && items.length > 0 && (
        <ul id="attention-list" className="w-full bg-surface border border-border rounded-xl divide-y divide-border">
          {items.map((item) => (
            <li key={item.key}>
              <Link to={item.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${item.severity === "alert" ? "bg-alert" : "bg-warning"}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink break-words">{item.account.name}</span>
                  <span className={`block text-xs ${item.severity === "alert" ? "text-alert" : "text-ink-muted"}`}>{item.text}</span>
                </span>
                <ChevronRight size={16} className="text-ink-muted shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SummaryPage = () => {
  const { isLoaded, allTransactions, accounts, balanceEntries } = useExpenseContext();
  const buckets = useBucketsWithCategories();

  const today = useMemo(() => new Date(), []);
  const currentMonthName = ALL_MONTHS[today.getMonth()];
  const currentYear = today.getFullYear();
  const lastMonthDate = new Date(currentYear, today.getMonth() - 1, 1);

  const thisMonthTx = useMemo(
    () => allTransactions.filter((t) => t.yearNumber === currentYear && t.monthName === currentMonthName),
    [allTransactions, currentYear, currentMonthName]
  );

  const monthlyRows = useMemo(() => buildMonthlyIncomeExpense(allTransactions, balanceEntries), [allTransactions, balanceEntries]);

  const thisMonthRow = findMonthRow(monthlyRows, currentYear, today.getMonth());
  const lastMonthRow = findMonthRow(monthlyRows, lastMonthDate.getFullYear(), lastMonthDate.getMonth());

  const thisMonthIncome = thisMonthRow?.income ?? 0;
  const thisMonthExpense = thisMonthRow?.expense ?? 0;

  const incomeChangeAmount = thisMonthIncome - (lastMonthRow?.income ?? 0);
  const incomeChangePct = lastMonthRow?.income ? (incomeChangeAmount / lastMonthRow.income) * 100 : null;

  const expenseChangeAmount = thisMonthExpense - (lastMonthRow?.expense ?? 0);
  const expenseChangePct = lastMonthRow?.expense ? (expenseChangeAmount / lastMonthRow.expense) * 100 : null;

  const savingsRatePct = thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100 : null;

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

  const whereItWent = useMemo(
    () =>
      [...groupByEffectiveBucket(classifyTransactions(thisMonthTx, buckets)).values()].map((g) => ({ name: g.bucketLabel, value: g.total })),
    [thisMonthTx, buckets]
  );

  const comingUp = useMemo(() => getUpcomingLiabilityEvents(accounts, balanceEntries, today, COMING_UP_DAYS), [accounts, balanceEntries, today]);

  const attentionItems = useMemo(() => getAttentionItems(accounts, balanceEntries, today), [accounts, balanceEntries, today]);

  if (!isLoaded) return <LoadingState />;
  if (accounts.length === 0 && allTransactions.length === 0) return <Onboarding />;

  const cardLink = "block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ledger hover:shadow-sm";
  const monthPath = `/expenses/${currentYear}/${currentMonthName}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-4">
      <h1 className="sr-only">Home</h1>
      <AttentionPanel items={attentionItems} />
      <InstallBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <NetWorthHeroCard accounts={accounts} balanceEntries={balanceEntries} />
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-1 gap-4">
          <Link to="/assets#history" className={cardLink} aria-label="This month's income - see income history">
            <MonthSummaryCard
              label="This Month's Income"
              value={thisMonthIncome}
              changeAmount={incomeChangeAmount}
              changePct={incomeChangePct}
              accent="ledger"
              compact
            />
          </Link>
          <Link to={monthPath} className={cardLink} aria-label={`This month's expenses - open ${currentMonthName} ${currentYear}`}>
            <MonthSummaryCard
              label="This Month's Expenses"
              value={thisMonthExpense}
              changeAmount={expenseChangeAmount}
              changePct={expenseChangePct}
              accent="alert"
              compact
            />
          </Link>
        </div>

        <section aria-label={`${currentMonthName} at a glance`} className="lg:col-span-2 grid grid-cols-3 gap-2 sm:gap-4">
          <StatTile
            label="Savings rate"
            value={savingsRatePct === null ? "—" : `${savingsRatePct.toFixed(0)}%`}
            sub="of income"
          />
          <StatTile
            label="Largest expense"
            value={<span className="money">{largestExpense ? formatCurrency(largestExpense.amount) : "—"}</span>}
            sub={largestExpense?.category}
            title={largestExpense ? `${largestExpense.category} on ${largestExpense.date.toLocaleDateString()}` : undefined}
          />
          <StatTile
            label="Top category"
            value={<span className="block truncate">{topCategory?.name || "—"}</span>}
            sub={topCategory ? `${topCategory.pct.toFixed(0)}% · ${formatCurrency(topCategory.amount)}` : undefined}
            title={topCategory?.name}
          />
        </section>

        <section aria-labelledby="where-title" className="bg-surface border border-border rounded-xl p-4 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 id="where-title" className="text-sm font-semibold text-ink">
              Where it went
            </h2>
            <Link to={monthPath} className="text-xs text-ledger-dark hover:underline">
              {currentMonthName}
            </Link>
          </div>
          {whereItWent.some((s) => s.value > 0) ? (
            <LabelledStackBar label={`${currentMonthName} spending by bucket`} segments={whereItWent} />
          ) : (
            <p className="text-sm text-ink-muted">Nothing spent yet this month.</p>
          )}
        </section>

        <div className="lg:col-span-3">
          <ComingUp events={comingUp} />
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
