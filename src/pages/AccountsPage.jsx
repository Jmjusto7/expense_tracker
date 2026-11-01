import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddAccountModal from "../components/AddAccountModal";
import EditAccountModal from "../components/EditAccountModal";
import AccountGroup from "../components/AccountGroup";
import CardActions from "../components/CardActions";
import LabelledStackBar from "../components/LabelledStackBar";
import IncomeExpenseChart from "../components/IncomeExpenseChart";
import ImpliedSpendChart from "../components/ImpliedSpendChart";
import HideBalancesToggle from "../components/HideBalancesToggle";
import Tour from "../components/Tour";
import { TOURS } from "../utils/tourSteps";
import { useStoredState } from "../hooks/useStoredState";
import { formatCurrency } from "../utils/formatCurrency";
import { colorsForKeys, formatUnits } from "../utils/chartFormat";
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
import { STALE_RECONCILIATION_DAYS } from "../utils/attention";
import { buildMonthlyIncomeExpense } from "../utils/incomeExpenseHelpers";
import { buildAccountTree, flattenDescendants, groupRootsByType, sortRoots, SORT_OPTIONS } from "../utils/accountHierarchy";

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days) => (days === 0 ? "today" : `${days}d ago`);
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// ▲/▼ with the % change; the arrow and sign carry the meaning, colour only reinforces it.
function Change({ now, before, className = "" }) {
  if (now == null || before == null || before === 0 || now === before) {
    return <span className={`text-[11px] text-ink-muted ${className}`}>{now != null && before != null ? "– 0%" : ""}</span>;
  }
  const pct = ((now - before) / Math.abs(before)) * 100;
  const up = pct > 0;
  return (
    <span
      className={`text-[11px] font-medium ${up ? "text-ledger-dark" : "text-alert"} ${className}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(pct).toFixed(1)}% vs last month`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { isLoaded = true, accounts, balanceEntries, allTransactions, accountTypes, removeAccount } = useExpenseContext();

  const assetAccounts = useMemo(() => accounts.filter((a) => !a.isLiability), [accounts]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);
  const [sortBy, setSortBy] = useStoredState("tracker.assets.sort", "value");
  const [collapsed, setCollapsed] = useStoredState("tracker.assets.collapsed", []);
  const [panel, setPanel] = useState(hash === "#history" ? "history" : "allocation");
  const [impliedAccountId, setImpliedAccountId] = useState("all");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => new Date(today.getTime() - 30 * DAY_MS), [today]);

  const handleRemoveAccount = async (accountId) => {
    setDeleteError("");
    try {
      await removeAccount(accountId);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account.");
    }
  };

  const valueById = useMemo(
    () => new Map(assetAccounts.map((a) => [a.id, getCurrentValuePhp(balanceEntries, assetAccounts, a.id, today)])),
    [assetAccounts, balanceEntries, today]
  );
  const priorById = useMemo(
    () => new Map(assetAccounts.map((a) => [a.id, getCurrentValuePhp(balanceEntries, assetAccounts, a.id, monthAgo)])),
    [assetAccounts, balanceEntries, monthAgo]
  );
  const valueOf = (account) => valueById.get(account.id) ?? null;
  const staleDaysOf = (account) => daysSinceLastReconciliation(balanceEntries, account.id);

  const totalBalance = useMemo(() => getTotalBalance(assetAccounts, balanceEntries, today), [assetAccounts, balanceEntries, today]);
  const priorTotal = useMemo(() => getTotalBalance(assetAccounts, balanceEntries, monthAgo), [assetAccounts, balanceEntries, monthAgo]);
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
  const hasHistory = monthlyIncomeExpenseData.length > 0 || accountsWithGaps.length > 0;

  const toggleGroup = (key) =>
    setCollapsed((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // Same names as the allocation bar, so row tiles match their type's segment.
  const typeColor = colorsForKeys(groups.filter((g) => g.subtotal > 0).map((g) => g.name));

  const renderRow = (account, depth = 0, typeName = "") => {
    const isForeign = account.unit != null;
    const tint = typeColor(typeName);
    const balance = getCurrentBalance(balanceEntries, account.id);
    const phpValue = valueOf(account);
    const staleDays = staleDaysOf(account);
    const priceDate = isForeign ? getLatestPriceDate(balanceEntries, account.id) : null;
    const priceAge = priceDate ? Math.max(0, Math.round((today - new Date(priceDate)) / DAY_MS)) : null;
    const stale = staleDays === null || staleDays > STALE_RECONCILIATION_DAYS;

    let sub;
    if (phpValue == null) sub = <span className="text-warning">⚠ Not valued - no price yet</span>;
    else if (isForeign)
      sub = (
        <>
          {priceAge == null ? "no price" : `price ${ago(priceAge)}`}
          {" · "}
          <span className="money">{balance == null ? "—" : formatUnits(balance, account.unit)}</span>
        </>
      );
    else if (stale) sub = <span className="text-warning">⚠ {staleDays === null ? "Never reconciled" : `Not reconciled · ${staleDays}d`}</span>;
    else sub = `Reconciled ${ago(staleDays)}`;

    return (
      <div
        key={account.id}
        className={`group relative flex items-center gap-3 py-2.5 pr-2 pl-[calc(0.75rem+var(--indent))] md:grid md:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_5rem_8rem_3.5rem] md:pl-3 hover:bg-surface-sunken focus-within:bg-surface-sunken transition-colors ${depth ? "bg-surface-sunken/60" : ""}`}
        style={{ "--indent": `${depth * 1.25}rem` }}
      >
        <span
          className="h-8 w-8 rounded-lg grid place-items-center shrink-0 text-[11px] font-bold"
          style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, white)`, color: tint }}
          aria-hidden="true"
        >
          {isForeign ? account.unit.slice(0, 3) : initials(account.name) || "?"}
        </span>
        <div className="flex-1 min-w-0 md:pl-[var(--indent)]">
          <Link
            to={`/assets/${account.id}`}
            title={account.name}
            className="block text-sm font-medium text-ink truncate focus-visible:outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ledger"
          >
            {depth > 0 && <span className="text-ink-muted" aria-hidden="true">↳ </span>}
            {account.name}
          </Link>
          <div className="text-[11px] text-ink-muted truncate md:hidden">{sub}</div>
        </div>
        <div className="hidden md:block text-xs text-ink-muted truncate">{sub}</div>
        <div className="hidden md:block text-right">
          <Change now={phpValue} before={priorById.get(account.id) ?? null} />
        </div>
        <div className="text-right shrink-0">
          <div className={`money text-sm font-semibold ${phpValue == null ? "text-warning" : phpValue < 0 ? "text-alert" : "text-ink"}`}>
            {phpValue == null ? "—" : formatCurrency(phpValue)}
          </div>
          <Change now={phpValue} before={priorById.get(account.id) ?? null} className="md:hidden" />
        </div>
        <CardActions
          compact
          size={13}
          label={account.name}
          onEdit={() => setEditAccountId(account.id)}
          onDelete={() => handleRemoveAccount(account.id)}
          deleteTitle="Delete account? Removes all its income and reconciliation history."
        />
      </div>
    );
  };

  const totalChange = priorTotal ? ((totalBalance - priorTotal) / Math.abs(priorTotal)) * 100 : null;

  return (
    <div data-balances className="page-shell">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h1 className="font-display text-2xl text-ink">Assets</h1>
        {isLoaded && assetAccounts.length > 0 && <Tour id="assets" steps={TOURS.assets} />}
        <div className="flex items-center gap-2">
          <HideBalancesToggle />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            Account
          </button>
        </div>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-alert bg-alert-soft rounded-md px-3 py-2 mb-4">
          {deleteError}
        </p>
      )}

      {!isLoaded && (
        <p role="status" className="text-ink-muted">
          Loading…
        </p>
      )}

      {isLoaded && assetAccounts.length === 0 && <p className="text-ink-muted">No accounts yet. Add one to start tracking balances.</p>}

      {assetAccounts.length > 0 && (
        <>
          <section id="history" aria-label="Total assets" className="bg-surface border border-border rounded-xl shadow-card overflow-hidden mb-6 scroll-mt-20">
            <div className="hero-ledger p-4 sm:p-5">
              <div className="text-xs text-white/75 uppercase tracking-wide">Total assets</div>
              <div className={`money font-display text-3xl sm:text-4xl font-bold mt-1 ${totalBalance < 0 ? "text-[#ffd4ce]" : ""}`}>
                {formatCurrency(totalBalance)}
              </div>
              {totalChange != null && totalBalance !== priorTotal && (
                <p className={`text-xs font-medium mt-1 ${totalBalance > priorTotal ? "text-white" : "text-[#ffd4ce]"}`}>
                  {totalBalance > priorTotal ? "▲ +" : "▼ -"}
                  {Math.abs(totalChange).toFixed(1)}% <span className="text-white/75 font-normal">vs last month ·</span>{" "}
                  <span className="money">{formatCurrency(Math.abs(totalBalance - priorTotal))}</span>
                </p>
              )}
              {hasLiabilities && (
                <p className="text-xs text-white/75 mt-1">
                  Net worth after{" "}
                  <Link to="/liabilities" className="text-white underline-offset-2 hover:underline">
                    liabilities
                  </Link>
                  : <span className="money font-semibold text-white">{formatCurrency(totalBalance + liabilityTotal)}</span>
                </p>
              )}
              {unvalued.length > 0 && (
                <p className="flex items-start gap-1 text-xs text-[#f6d58a] mt-1">
                  <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
                  {unvalued.length} account{unvalued.length === 1 ? "" : "s"} not valued ({unvalued.map((a) => a.name).join(", ")}) - not included above.
                </p>
              )}
            </div>
            <div className="px-4 py-3 sm:px-5">
              {hasHistory && (
                <div className="inline-flex rounded-full border border-border bg-surface-sunken p-0.5 mb-3" role="group" aria-label="Show">
                  {[
                    ["allocation", "Allocation"],
                    ["history", "History"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={panel === value}
                      onClick={() => setPanel(value)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${panel === value ? "bg-surface text-ink font-semibold shadow-sm" : "text-ink-muted hover:text-ink"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {panel === "history" && hasHistory ? (
                <div className="space-y-6">
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
              ) : (
                <LabelledStackBar label="Allocation by type" segments={groups.map((g) => ({ name: g.name, value: g.subtotal }))} />
              )}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Accounts</h2>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              Sort
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

          <div
            aria-hidden="true"
            className="hidden md:grid grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_5rem_8rem_3.5rem] gap-3 px-3 pr-2 mb-1 text-[10px] uppercase tracking-wide text-ink-muted"
          >
            <span />
            <span>Account</span>
            <span>Status</span>
            <span className="text-right">vs last month</span>
            <span className="text-right">Value</span>
            <span />
          </div>

          {groups.map((group) => (
            <AccountGroup
              key={group.key}
              id={`assets-${group.key}`}
              title={group.name}
              list
              collapsed={collapsed.includes(group.key)}
              onToggle={() => toggleGroup(group.key)}
              summary={
                <>
                  <span className="text-ink-muted">{group.count}</span>
                  {group.unvalued > 0 && <span className="text-warning">{group.unvalued} not valued</span>}
                  <span className="money font-semibold text-ink">{formatCurrency(group.subtotal)}</span>
                </>
              }
            >
              {sortRoots(group.roots, sortBy, { valueOf, staleDaysOf }).flatMap((root) => [
                renderRow(root, 0, group.name),
                ...flattenDescendants(root).map(({ account, depth }) => renderRow(account, depth, group.name)),
              ])}
            </AccountGroup>
          ))}
        </>
      )}

      {showAddModal && (
        <AddAccountModal onClose={() => setShowAddModal(false)} onCreated={(id) => navigate(`/assets/${id}`)} />
      )}
      {editAccountId && <EditAccountModal accountId={editAccountId} onClose={() => setEditAccountId(null)} />}
    </div>
  );
}
