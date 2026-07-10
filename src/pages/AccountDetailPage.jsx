import { useParams } from "react-router-dom";
import { useState } from "react";
import { Wallet, TrendingUp, Scale, Trash2 } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";
import {
  getCurrentBalance,
  daysSinceLastReconciliation,
  getImpliedSpendPeriods,
  getAccountEntriesSorted,
} from "../utils/balanceHelpers";
import AccountBalanceChart from "../components/AccountBalanceChart";
import AddIncomeModal from "../components/AddIncomeModal";
import ReconcileBalanceModal from "../components/ReconcileBalanceModal";
import ConfirmButton from "../components/ConfirmButton";
import StatCard from "../components/StatCard";
import Breadcrumbs from "../components/Breadcrumbs";

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const { accounts, balanceEntries, removeBalanceEntry } = useExpenseContext();

  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const numericId = Number(accountId);
  const account = accounts.find((a) => a.id === numericId);

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-alert">Account not found.</p>
      </div>
    );
  }

  const currentBalance = getCurrentBalance(balanceEntries, numericId);
  const staleDays = daysSinceLastReconciliation(balanceEntries, numericId);
  const periods = getImpliedSpendPeriods(balanceEntries, numericId);
  const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  // Most recent first, for the history table.
  const entries = getAccountEntriesSorted(balanceEntries, numericId).slice().reverse();

  const balanceColor = currentBalance != null && currentBalance < 0 ? "text-alert" : "text-ledger-dark";

  const handleDeleteEntry = async (entryId) => {
    setDeleteError("");
    try {
      await removeBalanceEntry(entryId);
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete that entry.");
      setTimeout(() => setDeleteError(""), 6000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Assets", to: "/assets" }, { label: account.name }]} />

      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-ledger-dark" />
          <h1 className="font-display text-2xl text-ink">{account.name}</h1>
        </div>

        <div className={`money text-2xl font-bold mt-2 ${balanceColor}`}>
          {currentBalance == null ? "—" : formatCurrency(currentBalance)}
        </div>

        <div className="text-xs text-ink-muted mt-1">
          {staleDays === null
            ? "Not reconciled yet"
            : staleDays === 0
              ? "As of today"
              : `As of ${staleDays} day${staleDays === 1 ? "" : "s"} ago - projected forward since then`}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowAddIncome(true)}
          className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <TrendingUp size={15} />
          Add Income
        </button>
        <button
          onClick={() => setShowReconcile(true)}
          className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Scale size={15} />
          Reconcile Balance
        </button>
      </div>

      {lastPeriod && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <StatCard
            label={lastPeriod.impliedSpend < 0 ? "Unaccounted Inflow (last period)" : "Implied Spend (last period)"}
            value={formatCurrency(Math.abs(lastPeriod.impliedSpend))}
            sublabel={`${formatDate(lastPeriod.fromDate)} – ${formatDate(lastPeriod.toDate)}`}
            accent={lastPeriod.impliedSpend < 0 ? "ledger" : "alert"}
          />
          <StatCard
            label="Income (last period)"
            value={formatCurrency(lastPeriod.incomeInPeriod)}
            sublabel="Logged between those two reconciliations"
          />
        </div>
      )}

      <div className="bg-surface rounded-lg border border-border p-6 mb-6">
        <div className="text-xs text-ink-muted uppercase tracking-wide mb-3">
          Balance Over Time
        </div>
        <AccountBalanceChart entries={balanceEntries} accountId={numericId} />
      </div>

      <div className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">History</h2>

        {deleteError && (
          <p className="text-alert text-sm bg-alert-soft rounded-md px-3 py-2 mb-3">
            {deleteError}
          </p>
        )}

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
              <th className="border border-border px-3 py-2 font-medium">Date</th>
              <th className="border border-border px-3 py-2 font-medium">Type</th>
              <th className="border border-border px-3 py-2 font-medium">Category</th>
              <th className="border border-border px-3 py-2 text-right font-medium">
                Amount / Balance
              </th>
              <th className="border border-border px-3 py-2 font-medium">Comments</th>
              <th className="border border-border px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>

          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="border border-border px-3 py-2 text-ink-muted">
                  {formatDate(e.date)}
                </td>
                <td className="border border-border px-3 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      e.type === "income"
                        ? "bg-ledger-soft text-ledger-dark border-ledger/30"
                        : "bg-travel-soft text-travel-dark border-travel/30"
                    }`}
                  >
                    {e.type === "income" ? "Income" : "Reconciled"}
                  </span>
                </td>
                <td className="border border-border px-3 py-2 text-ink">
                  {e.category || "—"}
                </td>
                <td className="money border border-border px-3 py-2 text-right font-semibold text-ink">
                  {formatCurrency(e.type === "income" ? e.amount : e.balance)}
                </td>
                <td className="border border-border px-3 py-2 text-ink-muted">
                  {e.comments}
                </td>
                <td className="border border-border px-2 py-2 text-center">
                  <ConfirmButton
                    onConfirm={() => handleDeleteEntry(e.id)}
                    className="text-ink-muted hover:text-alert p-1"
                    confirmClassName="text-alert text-xs font-medium px-1"
                    confirmLabel="Sure?"
                    title="Delete this entry"
                  >
                    <Trash2 size={14} />
                  </ConfirmButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries.length === 0 && (
          <p className="text-ink-muted text-sm text-center py-6">No entries yet.</p>
        )}
      </div>

      {showAddIncome && (
        <AddIncomeModal accountId={numericId} onClose={() => setShowAddIncome(false)} />
      )}

      {showReconcile && (
        <ReconcileBalanceModal accountId={numericId} onClose={() => setShowReconcile(false)} />
      )}
    </div>
  );
}
