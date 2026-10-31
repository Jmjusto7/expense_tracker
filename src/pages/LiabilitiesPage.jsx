import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, CreditCard } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddLiabilityModal from "../components/AddLiabilityModal";
import EditLiabilityModal from "../components/EditLiabilityModal";
import AccountGroup from "../components/AccountGroup";
import CardActions from "../components/CardActions";
import { useStoredState } from "../hooks/useStoredState";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";
import { getStatementInfo, getTotalBalance, getNextStatementClose } from "../utils/balanceHelpers";
import { UNCLASSIFIED } from "../utils/accountHierarchy";

const LIABILITY_SORTS = [
  { value: "owed", label: "Amount owed" },
  { value: "name", label: "Name" },
];

export default function LiabilitiesPage() {
  const navigate = useNavigate();
  const { accounts, balanceEntries, accountTypes, removeAccount } = useExpenseContext();

  const liabilityAccounts = useMemo(() => accounts.filter((a) => a.isLiability), [accounts]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);
  const [sortBy, setSortBy] = useStoredState("tracker.liabilities.sort", "owed");
  const [collapsed, setCollapsed] = useStoredState("tracker.liabilities.collapsed", []);
  const [deleteError, setDeleteError] = useState("");

  const handleRemoveAccount = async (accountId) => {
    setDeleteError("");
    try {
      await removeAccount(accountId);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account.");
    }
  };

  // Signed: negative = owed, positive = net credit in your favour.
  const netBalance = useMemo(() => getTotalBalance(liabilityAccounts, balanceEntries), [liabilityAccounts, balanceEntries]);
  const isNetCredit = netBalance > 0;

  const infoById = useMemo(
    () => new Map(liabilityAccounts.map((a) => [a.id, getStatementInfo(balanceEntries, a, new Date())])),
    [liabilityAccounts, balanceEntries]
  );
  const balanceOf = (a) => infoById.get(a.id)?.totalBalance ?? 0;

  // Grouped by account type; within a group, credits (positive balances) go last.
  const groups = useMemo(() => {
    const byType = new Map();
    for (const account of liabilityAccounts) {
      const key = String(account.typeId ?? UNCLASSIFIED);
      if (!byType.has(key)) {
        byType.set(key, {
          key,
          name: accountTypes.find((t) => t.id === account.typeId)?.name ?? "Unclassified",
          accounts: [],
          owed: 0,
          credit: 0,
        });
      }
      const group = byType.get(key);
      const balance = balanceOf(account);
      group.accounts.push(account);
      if (balance < 0) group.owed += -balance;
      else group.credit += balance;
    }
    return [...byType.values()].sort((a, b) => {
      if ((a.key === UNCLASSIFIED) !== (b.key === UNCLASSIFIED)) return a.key === UNCLASSIFIED ? 1 : -1;
      return b.owed - a.owed;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liabilityAccounts, accountTypes, infoById]);

  const sortAccounts = (list) =>
    [...list].sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : balanceOf(a) - balanceOf(b) || a.name.localeCompare(b.name)
    );

  const toggleGroup = (key) =>
    setCollapsed((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const renderCard = (account) => {
    const info = infoById.get(account.id);
    const isCredit = (info.totalBalance ?? 0) > 0;
    const nextClose = getNextStatementClose(balanceEntries, account);

    return (
      <div
        key={account.id}
        className="group relative bg-surface rounded-lg border border-border hover:border-alert focus-within:border-alert p-5 transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CreditCard size={15} className="text-alert shrink-0" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-ink truncate" title={account.name}>
              <Link
                to={`/liabilities/${account.id}`}
                className="focus-visible:outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-alert"
              >
                {account.name}
              </Link>
            </h3>
          </div>
          <CardActions
            label={account.name}
            onEdit={() => setEditAccountId(account.id)}
            onDelete={() => handleRemoveAccount(account.id)}
            deleteTitle="Delete this liability? Removes its history. Linked transactions survive, unlinked."
          />
        </div>

        <div className={`money text-xl font-bold mb-0.5 ${isCredit ? "text-ledger-dark" : "text-alert"}`}>
          {formatCurrency(Math.abs(info.totalBalance ?? 0))}
        </div>
        <div className="text-xs text-ink-muted mb-2">{isCredit ? "Credit balance (they owe you)" : "Owed"}</div>
        {account.creditLimit != null && (
          <div className={`text-xs mb-2 ${(info.availableCredit ?? 0) < 0 ? "text-alert" : "text-ink-muted"}`}>
            {(info.availableCredit ?? 0) < 0
              ? `Over limit by ${formatCurrency(Math.abs(info.availableCredit))}`
              : `${formatCurrency(info.availableCredit)} available (limit ${formatCurrency(account.creditLimit)})`}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {info.cutoffDate ? (
            <span
              className={`text-xs px-2 py-1 rounded-md ${info.isPaid ? "bg-ledger-soft text-ledger-dark" : "bg-warning-soft text-warning"}`}
            >
              {info.isPaid ? "Statement paid" : `${formatCurrency(Math.max(info.remainingDue ?? 0, 0))} due ${formatDate(info.dueDate)}`}
            </span>
          ) : (
            <span className="text-xs text-ink-muted">No statement logged yet</span>
          )}
          {nextClose?.overdue && (
            <span className="text-xs px-2 py-1 rounded-md bg-warning-soft text-warning">
              Log statement for {formatDate(nextClose.date)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <h1 className="font-display text-2xl text-ink">Liabilities</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-alert hover:bg-alert/90 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Add Liability
        </button>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2 mb-4">
          {deleteError}
        </p>
      )}

      {liabilityAccounts.length === 0 && (
        <p className="text-ink-muted">No liabilities yet. Add a credit card or loan to start tracking what you owe.</p>
      )}

      {liabilityAccounts.length > 0 && (
        <>
          <div className="bg-surface border border-border rounded-lg p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">{isNetCredit ? "Net Credit" : "Total Owed"}</h2>
              <span className={`money text-2xl font-bold ${isNetCredit ? "text-ledger-dark" : "text-alert"}`}>
                {formatCurrency(Math.abs(netBalance))}
              </span>
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
                {LIABILITY_SORTS.map((o) => (
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
              id={`liabilities-${group.key}`}
              title={group.name}
              collapsed={collapsed.includes(group.key)}
              onToggle={() => toggleGroup(group.key)}
              summary={
                <>
                  <span className="text-ink-muted">
                    {group.accounts.length} account{group.accounts.length === 1 ? "" : "s"}
                  </span>
                  <span className="money font-semibold text-alert">Owed {formatCurrency(group.owed)}</span>
                  {group.credit > 0 && (
                    <span className="money font-semibold text-ledger-dark">Credit {formatCurrency(group.credit)}</span>
                  )}
                </>
              }
            >
              {sortAccounts(group.accounts).map(renderCard)}
            </AccountGroup>
          ))}
        </>
      )}

      {showAddModal && (
        <AddLiabilityModal onClose={() => setShowAddModal(false)} onCreated={(id) => navigate(`/liabilities/${id}`)} />
      )}
      {editAccountId && <EditLiabilityModal accountId={editAccountId} onClose={() => setEditAccountId(null)} />}
    </div>
  );
}
