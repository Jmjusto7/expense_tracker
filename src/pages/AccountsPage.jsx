import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, AlertTriangle } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddAccountModal from "../components/AddAccountModal";
import EditAccountModal from "../components/EditAccountModal";
import AccountGroup from "../components/AccountGroup";
import CardActions from "../components/CardActions";
import AssetCompositionChart from "../components/AssetCompositionChart";
import AssetAllocationByTypeChart from "../components/AssetAllocationByTypeChart";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import ImpliedSpendChart from "../components/ImpliedSpendChart";
import { useStoredState } from "../hooks/useStoredState";
import { formatCurrency } from "../utils/formatCurrency";
import { formatUnits } from "../utils/chartFormat";
import { formatDate } from "../utils/dateHelpers";
import {
  getCurrentBalance,
  getCurrentValuePhp,
  daysSinceLastReconciliation,
  getTotalBalance,
  getUnvaluedAccounts,
  getImpliedSpendPeriods,
  getLatestPriceDate,
} from "../utils/balanceHelpers";
import { buildMonthlyIncomeExpense } from "../utils/incomeExpenseHelpers";
import {
  buildAccountTree,
  flattenDescendants,
  groupRootsByType,
  sortRoots,
  SORT_OPTIONS,
} from "../utils/accountHierarchy";

const reconciledLabel = (days) =>
  days === null ? "Not reconciled yet" : days === 0 ? "Reconciled today" : `Reconciled ${days} day${days === 1 ? "" : "s"} ago`;

export default function AccountsPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  const { accounts, balanceEntries, allTransactions, accountTypes, removeAccount } = useExpenseContext();

  // Liabilities live on their own page - same `accounts` table, filtered by isLiability.
  const assetAccounts = useMemo(() => accounts.filter((a) => !a.isLiability), [accounts]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);
  const [sortBy, setSortBy] = useStoredState("tracker.assets.sort", "value");
  const [collapsed, setCollapsed] = useStoredState("tracker.assets.collapsed", []);
  const [impliedAccountId, setImpliedAccountId] = useState("all");
  const [deleteError, setDeleteError] = useState("");

  const handleRemoveAccount = async (accountId) => {
    setDeleteError("");
    try {
      await removeAccount(accountId);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account.");
    }
  };

  const valueById = useMemo(
    () => new Map(assetAccounts.map((a) => [a.id, getCurrentValuePhp(balanceEntries, assetAccounts, a.id)])),
    [assetAccounts, balanceEntries]
  );
  const valueOf = (account) => valueById.get(account.id) ?? null;
  const staleDaysOf = (account) => daysSinceLastReconciliation(balanceEntries, account.id);

  const totalBalance = useMemo(() => getTotalBalance(assetAccounts, balanceEntries), [assetAccounts, balanceEntries]);
  const unvalued = useMemo(() => getUnvaluedAccounts(assetAccounts, balanceEntries), [assetAccounts, balanceEntries]);
  const liabilityTotal = useMemo(
    () => getTotalBalance(accounts.filter((a) => a.isLiability), balanceEntries),
    [accounts, balanceEntries]
  );
  const hasLiabilities = accounts.some((a) => a.isLiability);

  const groups = useMemo(
    () => groupRootsByType(buildAccountTree(assetAccounts), accountTypes, (a) => valueById.get(a.id) ?? null),
    [assetAccounts, accountTypes, valueById]
  );

  const monthlyIncomeExpenseData = useMemo(
    () => buildMonthlyIncomeExpense(allTransactions, balanceEntries),
    [allTransactions, balanceEntries]
  );

  // One row per reconciliation gap - not aligned to calendar months.
  const impliedSpendRows = useMemo(() => {
    return assetAccounts
      .filter((acc) => impliedAccountId === "all" || acc.id === impliedAccountId)
      .flatMap((acc) =>
        getImpliedSpendPeriods(balanceEntries, acc.id).map((p) => ({
          ...p,
          accountName: acc.name,
          label: impliedAccountId === "all" ? `${acc.name} · ${formatDate(p.toDate)}` : formatDate(p.toDate),
        }))
      )
      .sort((a, b) => new Date(a.toDate) - new Date(b.toDate));
  }, [assetAccounts, balanceEntries, impliedAccountId]);
  const accountsWithGaps = assetAccounts.filter((acc) => getImpliedSpendPeriods(balanceEntries, acc.id).length > 0);

  const toggleGroup = (key) =>
    setCollapsed((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const renderAccountCard = (account) => {
    const isForeign = account.unit != null;
    const balance = getCurrentBalance(balanceEntries, account.id);
    const phpValue = valueOf(account);
    const priceDate = isForeign ? getLatestPriceDate(balanceEntries, account.id) : null;
    const balanceColor = phpValue != null && phpValue < 0 ? "text-alert" : "text-ledger-dark";

    return (
      <div className="group relative bg-surface rounded-lg border border-border hover:border-ledger focus-within:border-ledger p-5 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet size={15} className="text-ledger-dark shrink-0" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-ink truncate" title={account.name}>
              <Link
                to={`/assets/${account.id}`}
                className="focus-visible:outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ledger"
              >
                {account.name}
              </Link>
            </h3>
          </div>
          <CardActions
            label={account.name}
            onEdit={() => setEditAccountId(account.id)}
            onDelete={() => handleRemoveAccount(account.id)}
            deleteTitle="Delete account? Removes all its income and reconciliation history."
          />
        </div>

        {isForeign ? (
          <>
            <div className="money text-xl font-bold mb-0.5 text-ink">{balance == null ? "—" : formatUnits(balance, account.unit)}</div>
            <div className={`money text-sm mb-1 ${phpValue == null ? "text-warning" : balanceColor}`}>
              {phpValue == null ? "Not valued - no price yet" : `≈ ${formatCurrency(phpValue)}`}
            </div>
          </>
        ) : (
          <div className={`money text-xl font-bold mb-1 ${phpValue == null ? "text-warning" : balanceColor}`}>
            {phpValue == null ? "Not valued yet" : formatCurrency(phpValue)}
          </div>
        )}

        <div className="text-xs text-ink-muted space-y-0.5">
          <div>{reconciledLabel(staleDaysOf(account))}</div>
          {isForeign && <div>{priceDate ? `Price as of ${formatDate(priceDate)}` : "No price logged"}</div>}
        </div>
      </div>
    );
  };

  // Accounts priced in this one (e.g. a stock priced in a USD wallet), indented per depth.
  const renderDescendantRow = ({ account, depth }) => {
    const isForeign = account.unit != null;
    const balance = getCurrentBalance(balanceEntries, account.id);
    const phpValue = valueOf(account);

    return (
      <div
        key={account.id}
        style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        className="group relative flex items-center justify-between gap-3 py-2 pr-3 border-t border-border/60 hover:bg-surface focus-within:bg-surface transition-colors"
      >
        <div className="min-w-0 flex-1">
          <Link
            to={`/assets/${account.id}`}
            className="block text-sm font-medium text-ink truncate focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ledger"
            title={account.name}
          >
            {account.name}
          </Link>
          {isForeign && (
            <div className="money text-xs text-ink-muted">{balance == null ? "—" : formatUnits(balance, account.unit)}</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`money text-sm font-semibold ${phpValue == null ? "text-warning" : phpValue < 0 ? "text-alert" : "text-ledger-dark"}`}>
            {phpValue == null ? "Not valued" : formatCurrency(phpValue)}
          </span>
          <CardActions
            compact
            size={12}
            label={account.name}
            onEdit={() => setEditAccountId(account.id)}
            onDelete={() => handleRemoveAccount(account.id)}
            deleteTitle="Delete account? Removes all its income and reconciliation history."
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <h1 className="font-display text-2xl text-ink">Assets</h1>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Add Account
        </button>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2 mb-4">
          {deleteError}
        </p>
      )}

      {assetAccounts.length === 0 && <p className="text-ink-muted">No accounts yet. Add one to start tracking balances.</p>}

      {assetAccounts.length > 0 && (
        <>
          <div className="bg-surface border border-border rounded-lg p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <h2 className="text-base font-semibold text-ink">Total Balance</h2>
              <span className={`money text-2xl font-bold ${totalBalance < 0 ? "text-alert" : "text-ledger-dark"}`}>
                {formatCurrency(totalBalance)}
              </span>
            </div>
            {unvalued.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-warning mb-1">
                <AlertTriangle size={13} aria-hidden="true" />
                {unvalued.length} account{unvalued.length === 1 ? "" : "s"} not valued ({unvalued.map((a) => a.name).join(", ")}) - not included above.
              </p>
            )}
            {hasLiabilities && (
              <p className="text-sm text-ink-muted mb-4">
                Net worth after{" "}
                <Link to="/liabilities" className="text-ledger-dark hover:underline">
                  liabilities
                </Link>
                : <span className="money font-semibold text-ink">{formatCurrency(totalBalance + liabilityTotal)}</span>
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 mt-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold mb-2 text-ink">Composition</h3>
                <AssetCompositionChart accounts={assetAccounts} balanceEntries={balanceEntries} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold mb-2 text-ink">Allocation by Type</h3>
                <AssetAllocationByTypeChart accounts={assetAccounts} accountTypes={accountTypes} balanceEntries={balanceEntries} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold text-ink">Accounts</h2>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-border rounded-md px-2 py-1 bg-surface text-ink text-sm"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {groups.map((group) => (
            <AccountGroup
              key={group.key}
              id={`assets-${group.key}`}
              title={group.name}
              collapsed={collapsed.includes(group.key)}
              onToggle={() => toggleGroup(group.key)}
              summary={
                <>
                  <span className="text-ink-muted">
                    {group.count} account{group.count === 1 ? "" : "s"}
                  </span>
                  {group.unvalued > 0 && <span className="text-warning">{group.unvalued} not valued</span>}
                  <span className="money font-semibold text-ink">{formatCurrency(group.subtotal)}</span>
                  {totalBalance > 0 && (
                    <span className="text-ink-muted">{Math.round((group.subtotal / totalBalance) * 100)}%</span>
                  )}
                </>
              }
            >
              {sortRoots(group.roots, sortBy, { valueOf, staleDaysOf }).map((root) => {
                const descendants = flattenDescendants(root);
                return (
                  <div key={root.id} className="flex flex-col">
                    {renderAccountCard(root)}
                    {descendants.length > 0 && (
                      <div className="mt-2 bg-surface-sunken border border-border rounded-lg overflow-hidden">
                        <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide px-3 pt-2 pb-1">
                          Holdings
                        </div>
                        {descendants.map(renderDescendantRow)}
                      </div>
                    )}
                  </div>
                );
              })}
            </AccountGroup>
          ))}

          {(monthlyIncomeExpenseData.length > 0 || accountsWithGaps.length > 0) && (
            <div id="history" className="bg-surface border border-border rounded-lg p-4 sm:p-6 mt-2 space-y-6 scroll-mt-20">
              <h2 className="text-lg font-semibold text-ink">History</h2>
              {monthlyIncomeExpenseData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-ink">Income vs Expense · all history</h3>
                  <IncomeExpenseChart data={monthlyIncomeExpenseData} />
                </div>
              )}

              {accountsWithGaps.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-ink">Implied Spend (reconciliation gaps)</h3>
                    <select
                      value={impliedAccountId}
                      onChange={(e) => setImpliedAccountId(e.target.value)}
                      aria-label="Account"
                      className="border border-border rounded-md px-2 py-1 bg-surface text-ink text-sm"
                    >
                      <option value="all">All accounts</option>
                      {accountsWithGaps.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-ink-muted mb-2">
                    Each bar is the gap between two consecutive reconciliations on one account, not a calendar month.
                  </p>
                  <ImpliedSpendChart data={impliedSpendRows} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddAccountModal onClose={() => setShowAddModal(false)} onCreated={(id) => navigate(`/assets/${id}`)} />
      )}
      {editAccountId && <EditAccountModal accountId={editAccountId} onClose={() => setEditAccountId(null)} />}
    </div>
  );
}
