import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddAccountModal from "../components/AddAccountModal";
import EditAccountModal from "../components/EditAccountModal";
import ConfirmButton from "../components/ConfirmButton";
import AssetCompositionChart from "../components/AssetCompositionChart";
import AssetAllocationByTypeChart from "../components/AssetAllocationByTypeChart";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import ImpliedSpendChart from "../components/ImpliedSpendChart";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";
import {
  getCurrentBalance,
  daysSinceLastReconciliation,
  getTotalBalance,
  getImpliedSpendPeriods,
} from "../utils/balanceHelpers";
import { buildMonthlyIncomeExpense } from "../utils/incomeExpenseHelpers";

export default function AccountsPage() {
  const { accounts, balanceEntries, allTransactions, accountTypes, removeAccount } = useExpenseContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);

  const totalBalance = useMemo(() => getTotalBalance(accounts, balanceEntries), [accounts, balanceEntries]);

  const monthlyIncomeExpenseData = useMemo(
    () => buildMonthlyIncomeExpense(allTransactions, balanceEntries),
    [allTransactions, balanceEntries]
  );

  // One row per reconciliation gap, across every account, sorted
  // chronologically - kept on its own timeline rather than forced into
  // calendar months (reconciliation periods can skip months).
  const impliedSpendRows = useMemo(() => {
    return accounts
      .flatMap((acc) =>
        getImpliedSpendPeriods(balanceEntries, acc.id).map((p) => ({
          ...p,
          accountName: acc.name,
          label: `${acc.name} · ${formatDate(p.toDate)}`,
        }))
      )
      .sort((a, b) => new Date(a.toDate) - new Date(b.toDate));
  }, [accounts, balanceEntries]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-center mb-6 gap-2">
        <h1 className="font-display text-2xl text-ink">Assets</h1>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Account
        </button>
      </div>

      {accounts?.length === 0 && (
        <p className="text-ink-muted">
          No accounts yet. Add one to start tracking balances.
        </p>
      )}

      {accounts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-ink">Total Balance</h2>
            <span className={`money text-2xl font-bold ${totalBalance < 0 ? "text-alert" : "text-ledger-dark"}`}>
              {formatCurrency(totalBalance)}
            </span>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2 text-ink">Composition</h3>
            <AssetCompositionChart accounts={accounts} balanceEntries={balanceEntries} />
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2 text-ink">Allocation by Type</h3>
            <AssetAllocationByTypeChart
              accounts={accounts}
              accountTypes={accountTypes}
              balanceEntries={balanceEntries}
            />
          </div>

          {monthlyIncomeExpenseData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-ink">Income vs Expense</h3>
              <IncomeExpenseChart data={monthlyIncomeExpenseData} />
            </div>
          )}

          {impliedSpendRows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-ink">
                Implied Spend (reconciliation gaps)
              </h3>
              <p className="text-xs text-ink-muted mb-2">
                Not aligned to calendar months - each bar is the gap between two consecutive
                reconciliations on one account.
              </p>
              <ImpliedSpendChart data={impliedSpendRows} />
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts?.map((account) => {
          const balance = getCurrentBalance(balanceEntries, account.id);
          const staleDays = daysSinceLastReconciliation(balanceEntries, account.id);
          const balanceColor = balance != null && balance < 0 ? "text-alert" : "text-ledger-dark";
          const typeName = account.typeId != null
            ? accountTypes.find((t) => t.id === account.typeId)?.name
            : null;

          return (
            <Link
              key={account.id}
              to={`/assets/${account.id}`}
              className="group bg-surface rounded-lg border border-border hover:border-ledger p-5 transition-colors relative block"
            >
              {/* Edit & Delete Buttons */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditAccountId(account.id);
                  }}
                  className="bg-surface border border-border text-ink-muted hover:text-ink rounded-md p-1.5"
                >
                  <Pencil size={14} />
                </button>

                <ConfirmButton
                  onConfirm={() => removeAccount(account.id)}
                  className="bg-surface border border-border text-ink-muted hover:text-alert rounded-md p-1.5"
                  confirmClassName="bg-alert text-white border border-alert rounded-md p-1.5 text-xs font-medium px-2"
                  title="Delete account? Removes all its income and reconciliation history."
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </div>

              {/* Title */}
              <div className="flex items-center gap-1.5 mb-1 pr-14">
                <Wallet size={15} className="text-ledger-dark shrink-0" />
                <h2 className="text-lg font-semibold text-ink truncate">
                  {account.name}
                </h2>
              </div>

              {/* Type badge */}
              <div className="mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    typeName
                      ? "bg-ledger-soft text-ledger-dark border-ledger/30"
                      : "bg-surface-sunken text-ink-muted border-border"
                  }`}
                >
                  {typeName || "Unclassified"}
                </span>
              </div>

              {/* Balance */}
              <div className={`money text-xl font-bold mb-1 ${balanceColor}`}>
                {balance == null ? "—" : formatCurrency(balance)}
              </div>

              {/* Staleness */}
              <div className="text-xs text-ink-muted">
                {staleDays === null
                  ? "Not reconciled yet"
                  : staleDays === 0
                    ? "Reconciled today"
                    : `Reconciled ${staleDays} day${staleDays === 1 ? "" : "s"} ago`}
              </div>
            </Link>
          );
        })}
      </div>

      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} />}

      {editAccountId && (
        <EditAccountModal
          accountId={editAccountId}
          onClose={() => setEditAccountId(null)}
        />
      )}
    </div>
  );
}
