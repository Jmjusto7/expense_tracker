import { useParams } from "react-router-dom";
import { useState } from "react";
import { CreditCard, Scale, ArrowLeftRight, CalendarCheck, Trash2, ChevronDown } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate, ALL_MONTHS } from "../utils/dateHelpers";
import { getStatementInfo, getAccountEntriesSorted, getStatementCloseEntries } from "../utils/balanceHelpers";
import AccountBalanceChart from "../components/AccountBalanceChart";
import ReconcileBalanceModal from "../components/ReconcileBalanceModal";
import TransferModal from "../components/TransferModal";
import LogStatementCloseModal from "../components/LogStatementCloseModal";
import ConfirmButton from "../components/ConfirmButton";
import StatCard from "../components/StatCard";
import Breadcrumbs from "../components/Breadcrumbs";

export default function LiabilityDetailPage() {
  const { liabilityId } = useParams();
  const { accounts, balanceEntries, allTransactions, removeBalanceEntry } = useExpenseContext();

  const [showReconcile, setShowReconcile] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showLogClose, setShowLogClose] = useState(false);
  const [showAllCycles, setShowAllCycles] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const numericId = Number(liabilityId);
  const account = accounts.find((a) => a.id === numericId);

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-alert">Liability not found.</p>
      </div>
    );
  }

  const info = getStatementInfo(balanceEntries, account, new Date());
  const isCredit = (info.totalBalance ?? 0) > 0;

  // Most recent first, for the history table. Excludes "expense" - the
  // shadow entry auto-generated for a transaction linked via "Paid From"
  // (see ExpenseContext's syncShadowExpenseEntry) - that spend is already
  // visible on the Expenses tab; History stays limited to actions taken
  // directly here (reconcile, transfer/payment, statement closes).
  const entries = getAccountEntriesSorted(balanceEntries, numericId)
    .filter((e) => e.type !== "expense")
    .slice()
    .reverse();

  // Groups this liability's linked ("Paid From") transactions into
  // billing-cycle buckets, bounded by its own logged statement closes (see
  // getStatementCloseEntries) - so what actually comprises Total Balance
  // and Statement Balance is answerable right here, not just by cross-
  // referencing the Expenses tab. Most recent cycle (the still-
  // accumulating, unbilled one) first. A plain const rather than useMemo,
  // matching `entries` above - keeps this file's hook order simple given
  // the early return right below.
  const linkedTransactions = allTransactions.filter((t) => t.accountId === numericId);
  const closes = getStatementCloseEntries(balanceEntries, numericId);

  // Cycle boundaries: (-∞, close1], (close1, close2], ..., (lastClose, now]
  const cycleBoundaries = [null, ...closes.map((c) => c.date), null];
  const cycleBuckets = [];
  for (let i = 0; i < cycleBoundaries.length - 1; i++) {
    cycleBuckets.push({ start: cycleBoundaries[i], end: cycleBoundaries[i + 1], transactions: [] });
  }

  linkedTransactions.forEach((t) => {
    const tDate = new Date(t.yearNumber, ALL_MONTHS.indexOf(t.monthName), t.dayNumber);
    const tTs = tDate.getTime();
    const bucket = cycleBuckets.find((b) => {
      const afterStart = !b.start || tTs > b.start.getTime();
      const atOrBeforeEnd = !b.end || tTs <= b.end.getTime();
      return afterStart && atOrBeforeEnd;
    });
    if (bucket) bucket.transactions.push({ ...t, resolvedDate: tDate });
  });

  const cycles = cycleBuckets
    .map((b) => ({
      ...b,
      transactions: b.transactions.sort((a, c) => a.resolvedDate - c.resolvedDate),
      total: b.transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    }))
    .reverse() // most recent cycle first
    .filter((c, i) => c.transactions.length > 0 || i === 0); // always show the current cycle, even empty

  const visibleCycles = showAllCycles ? cycles : cycles.slice(0, 2);
  const hiddenCycleCount = cycles.length - visibleCycles.length;

  const cycleLabel = (cycle) =>
    cycle.end === null
      ? cycle.start
        ? `Current Cycle (since ${formatDate(cycle.start)})`
        : "Current Cycle"
      : cycle.start
        ? `Statement: ${formatDate(cycle.start)} – ${formatDate(cycle.end)}`
        : `Through ${formatDate(cycle.end)}`;

  const handleDeleteEntry = async (entryId) => {
    setDeleteError("");
    try {
      await removeBalanceEntry(entryId);
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete that entry.");
      setTimeout(() => setDeleteError(""), 6000);
    }
  };

  const typeLabel = (t) =>
    t === "reconciliation" ? "Reconciled" : t === "transfer" ? "Payment / Transfer" : t === "statementClose" ? "Statement Close" : "—";

  const typeBadgeClass = (t) => {
    if (t === "statementClose") return "bg-surface-sunken text-ink-muted border-border";
    if (t === "transfer") return "bg-ledger-soft text-ledger-dark border-ledger/30";
    return "bg-travel-soft text-travel-dark border-travel/30"; // reconciliation
  };

  const formatEntryValue = (e) => {
    if (e.type === "reconciliation") return formatCurrency(Math.abs(e.balance));
    if (e.type === "transfer") return `${e.amount >= 0 ? "+" : ""}${formatCurrency(e.amount)}`;
    return "—"; // statementClose is a pure date marker, no amount
  };

  const entrySupplementalNote = (e) => {
    if (e.type !== "transfer") return null;
    const counterpart = accounts.find((a) => a.id === e.counterpartAccountId);
    const name = counterpart?.name || "a deleted account";
    return e.amount < 0 ? `→ ${name}` : `← ${name}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Liabilities", to: "/liabilities" }, { label: account.name }]} />

      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-alert" />
          <h1 className="font-display text-2xl text-ink">{account.name}</h1>
        </div>

        <div className={`money text-2xl font-bold mt-2 ${isCredit ? "text-ledger-dark" : "text-alert"}`}>
          {formatCurrency(Math.abs(info.totalBalance ?? 0))}
        </div>
        <div className="text-xs text-ink-muted mt-1">
          {isCredit
            ? "Credit balance (they owe you), including anything unbilled since the last statement"
            : "Total balance owed, including unbilled charges since the last statement"}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowTransfer(true)}
          className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowLeftRight size={15} />
          Make a Payment
        </button>
        <button
          onClick={() => setShowReconcile(true)}
          className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Scale size={15} />
          Reconcile
        </button>
        <button
          onClick={() => setShowLogClose(true)}
          className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <CalendarCheck size={15} />
          Log Statement Close
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Statement Balance"
          value={info.statementBalance == null ? "—" : formatCurrency(Math.abs(info.statementBalance))}
          sublabel={
            info.cutoffDate
              ? `As of ${formatDate(info.cutoffDate)} · ${info.isPaid ? "Paid" : `Due ${formatDate(info.dueDate)}`}`
              : "No statement logged yet"
          }
          accent={info.cutoffDate ? (info.isPaid ? "ledger" : "alert") : "ledger"}
        />
        <StatCard
          label="Available Credit"
          value={
            account.creditLimit == null
              ? "—"
              : `${info.availableCredit < 0 ? "-" : ""}${formatCurrency(Math.abs(info.availableCredit ?? 0))}`
          }
          sublabel={
            account.creditLimit == null
              ? "No limit set"
              : info.availableCredit < 0
                ? `Over limit by ${formatCurrency(Math.abs(info.availableCredit))} (limit ${formatCurrency(account.creditLimit)})`
                : `of ${formatCurrency(account.creditLimit)} limit`
          }
          accent={account.creditLimit != null && info.availableCredit < 0 ? "alert" : "ledger"}
        />
      </div>

      <div className="bg-surface rounded-lg border border-border p-4 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-3">What Comprises This Balance</h2>
        <p className="text-xs text-ink-muted mb-3">
          Transactions linked here via "Paid From" - each billing cycle bounded by the statement
          closes you've logged below.
        </p>

        {visibleCycles.map((cycle, i) => (
          <div key={cycle.start ? cycle.start.toISOString() : "start"} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between bg-surface-sunken px-3 py-2 rounded-t-md border border-border">
              <span className="text-xs font-semibold text-ink">
                {cycleLabel(cycle)}
                {cycle.end === null && (
                  <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-soft text-warning uppercase tracking-wide">
                    Unbilled
                  </span>
                )}
              </span>
              <span className="money text-xs font-semibold text-alert">{formatCurrency(cycle.total)}</span>
            </div>

            {cycle.transactions.length === 0 ? (
              <p className="text-xs text-ink-muted text-center py-4 border border-t-0 border-border rounded-b-md">
                No charges linked yet this cycle.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <tbody>
                  {cycle.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="border-t border-border px-3 py-1.5 text-ink-muted text-xs whitespace-nowrap">
                        {formatDate(t.resolvedDate)}
                      </td>
                      <td className="border-t border-border px-3 py-1.5 text-ink w-[30%]">{t.category}</td>
                      <td className="border-t border-border px-3 py-1.5 text-ink-muted text-xs">{t.comments}</td>
                      <td className="money border-t border-border px-3 py-1.5 text-right font-medium text-ink w-[110px]">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {hiddenCycleCount > 0 && (
          <button
            onClick={() => setShowAllCycles(true)}
            className="flex items-center gap-1 text-xs text-ledger-dark hover:underline mt-1"
          >
            <ChevronDown size={12} />
            Show {hiddenCycleCount} earlier cycle{hiddenCycleCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className="bg-surface rounded-lg border border-border p-6 mb-6">
        <div className="text-xs text-ink-muted uppercase tracking-wide mb-3">Balance Over Time</div>
        <AccountBalanceChart entries={balanceEntries} accountId={numericId} />
      </div>

      <div className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">History</h2>

        {deleteError && (
          <p className="text-alert text-sm bg-alert-soft rounded-md px-3 py-2 mb-3">{deleteError}</p>
        )}

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
              <th className="border border-border px-3 py-2 font-medium">Date</th>
              <th className="border border-border px-3 py-2 font-medium">Type</th>
              <th className="border border-border px-3 py-2 text-right font-medium">Amount / Balance</th>
              <th className="border border-border px-3 py-2 font-medium">Comments</th>
              <th className="border border-border px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>

          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="border border-border px-3 py-2 text-ink-muted">{formatDate(e.date)}</td>
                <td className="border border-border px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadgeClass(e.type)}`}>
                    {typeLabel(e.type)}
                  </span>
                </td>
                <td className="money border border-border px-3 py-2 text-right font-semibold text-ink">
                  {formatEntryValue(e)}
                </td>
                <td className="border border-border px-3 py-2 text-ink-muted">
                  {entrySupplementalNote(e) && (
                    <div className="text-xs text-ink-muted/80">{entrySupplementalNote(e)}</div>
                  )}
                  {e.comments}
                </td>
                <td className="border border-border px-2 py-2 text-center">
                  <ConfirmButton
                    onConfirm={() => handleDeleteEntry(e.id)}
                    className="text-ink-muted hover:text-alert p-1"
                    confirmClassName="text-alert text-xs font-medium px-1"
                    confirmLabel="Sure?"
                    title={e.type === "transfer" ? "Delete this transfer? Removes both sides." : "Delete this entry"}
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

      {showReconcile && (
        <ReconcileBalanceModal accountId={numericId} onClose={() => setShowReconcile(false)} />
      )}

      {showTransfer && (
        <TransferModal accountId={numericId} mode="incoming" onClose={() => setShowTransfer(false)} />
      )}

      {showLogClose && (
        <LogStatementCloseModal accountId={numericId} onClose={() => setShowLogClose(false)} />
      )}
    </div>
  );
}
