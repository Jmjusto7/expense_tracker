import { Link, useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import { Plus, ArrowLeftRight, CalendarCheck, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddLiabilityModal from "../components/AddLiabilityModal";
import EditLiabilityModal from "../components/EditLiabilityModal";
import TransferModal from "../components/TransferModal";
import LogStatementCloseModal from "../components/LogStatementCloseModal";
import ConfirmButton from "../components/ConfirmButton";
import HideBalancesToggle from "../components/HideBalancesToggle";
import { formatCurrency } from "../utils/formatCurrency";
import { getStatementInfo, getTotalBalance } from "../utils/balanceHelpers";
import { liabilityStatus } from "../utils/attention";

const DAY_MS = 24 * 60 * 60 * 1000;
const CARD_GRADIENTS = [
  ["#175646", "#2f7d68"],
  ["#3e4f63", "#4f6f8a"],
  ["#4f4170", "#7a6a9a"],
  ["#6b3a17", "#944d22"],
  ["#2b3a36", "#4a5a55"],
];
const gradientFor = (name) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = CARD_GRADIENTS[h % CARD_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
};
const TONE_CLASSES = {
  alert: "bg-alert-soft text-alert",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-sunken text-ink-muted",
  ok: "bg-ledger-soft text-ledger-dark",
  muted: "bg-surface-sunken text-ink-muted",
};
const URGENCY = { alert: 0, warning: 1, neutral: 2, muted: 3, ok: 4 };
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function StatusPill({ status, onCard = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        onCard ? "bg-white/20 text-white" : TONE_CLASSES[status.tone]
      }`}
    >
      {status.short}
    </span>
  );
}

// Share of the credit limit in use, with the % printed in the middle.
function UsageRing({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const high = pct >= 70;
  return (
    <svg viewBox="0 0 36 36" className="h-20 w-20 shrink-0" role="img" aria-label={`${Math.round(pct)}% of the credit limit used${high ? ", high" : ""}`}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-surface-sunken)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke={high ? "var(--color-alert)" : "var(--color-ledger)"}
        strokeWidth="4"
        strokeDasharray={`${clamped} 100`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="19" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--color-ink)">
        {Math.round(pct)}%
      </text>
      <text x="18" y="25.5" textAnchor="middle" fontSize="3.6" fill="var(--color-ink-muted)">
        {high ? "high" : "used"}
      </text>
    </svg>
  );
}

export default function LiabilitiesPage() {
  const navigate = useNavigate();
  const { isLoaded = true, accounts, balanceEntries, removeAccount } = useExpenseContext();
  const liabilities = useMemo(() => accounts.filter((a) => a.isLiability), [accounts]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState(null);
  const [payAccountId, setPayAccountId] = useState(null);
  const [logCloseId, setLogCloseId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const walletRef = useRef(null);

  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => new Date(today.getTime() - 30 * DAY_MS), [today]);

  const infoById = useMemo(
    () => new Map(liabilities.map((a) => [a.id, getStatementInfo(balanceEntries, a, today)])),
    [liabilities, balanceEntries, today]
  );
  const owedOf = (a) => -(infoById.get(a.id)?.totalBalance ?? 0);

  // Statement-based accounts are shown as cards; the rest (loans) as a simple list.
  const cards = useMemo(() => {
    const list = liabilities.filter((a) => a.statementCutoffDay);
    return list
      .map((a) => ({ account: a, info: infoById.get(a.id), status: liabilityStatus(infoById.get(a.id), today) }))
      .sort((x, y) => URGENCY[x.status.tone] - URGENCY[y.status.tone] || owedOf(y.account) - owedOf(x.account));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liabilities, infoById, today]);
  const loans = liabilities.filter((a) => !a.statementCutoffDay);

  const netBalance = useMemo(() => getTotalBalance(liabilities, balanceEntries, today), [liabilities, balanceEntries, today]);
  const priorBalance = useMemo(() => getTotalBalance(liabilities, balanceEntries, monthAgo), [liabilities, balanceEntries, monthAgo]);
  const isNetCredit = netBalance > 0;
  const owedChange = priorBalance ? ((-netBalance - -priorBalance) / Math.abs(priorBalance)) * 100 : null;

  const selected = cards.find((c) => c.account.id === selectedId) ?? cards[0] ?? null;

  const selectCard = (id) => {
    setSelectedId(id);
    walletRef.current?.querySelector(`[data-card="${CSS.escape(String(id))}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const handleRemove = async (accountId) => {
    setDeleteError("");
    try {
      await removeAccount(accountId);
      setSelectedId(null);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete account.");
    }
  };

  const renderVisualCard = ({ account, info, status }) => {
    const owed = owedOf(account);
    const usage = account.creditLimit ? (owed / account.creditLimit) * 100 : null;
    const isSelected = selected?.account.id === account.id;
    return (
      <button
        key={account.id}
        type="button"
        data-card={account.id}
        aria-pressed={isSelected}
        aria-label={`${account.name}: ${status.label}`}
        onClick={() => setSelectedId(account.id)}
        className={`snap-center shrink-0 w-[17rem] md:w-auto h-40 rounded-2xl p-4 text-left text-white flex flex-col justify-between shadow-md transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
          isSelected ? "ring-2 ring-ink ring-offset-2" : "hover:-translate-y-0.5"
        }`}
        style={{ background: gradientFor(account.name) }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm truncate">{account.name}</span>
          <StatusPill status={status} onCard />
        </div>
        <div>
          <div className="text-[11px] text-white/80">{owed < 0 ? "Credit balance" : "Owed"}</div>
          <div className="money text-2xl font-bold">{formatCurrency(Math.abs(owed))}</div>
        </div>
        <div className="text-[11px] text-white/85 truncate">
          {info.dueDate && (info.remainingDue ?? 0) > 0 ? (
            <>
              Statement <span className="money">{formatCurrency(info.remainingDue)}</span> · due {shortDate(info.dueDate)}
            </>
          ) : (
            status.label
          )}
          {usage != null && ` · ${Math.round(usage)}% of limit`}
        </div>
      </button>
    );
  };

  const renderDetail = ({ account, info, status }) => {
    const owed = owedOf(account);
    const usage = account.creditLimit ? (Math.max(owed, 0) / account.creditLimit) * 100 : null;
    return (
      <section aria-label={`${account.name} details`} className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink truncate">{account.name}</h2>
            <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
          </div>
          <Link to={`/liabilities/${account.id}`} className="flex items-center gap-0.5 text-sm text-ledger-dark hover:underline shrink-0">
            Details <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {usage != null && <UsageRing pct={usage} />}
          <dl className="text-sm space-y-1 min-w-0">
            {account.creditLimit != null && (
              <div>
                <dt className="sr-only">Available</dt>
                <dd>
                  <span className="money font-semibold text-ink">{formatCurrency(account.creditLimit - Math.max(owed, 0))}</span>{" "}
                  <span className="text-ink-muted">
                    available of <span className="money">{formatCurrency(account.creditLimit)}</span>
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">Statement</dt>
              <dd className="text-ink-muted">
                {info.dueDate ? (
                  <>
                    Statement <span className="money text-ink">{formatCurrency(Math.abs(info.statementBalance ?? 0))}</span>
                    {(info.remainingDue ?? 0) > 0 ? (
                      <>
                        {" "}
                        · <span className="money text-ink">{formatCurrency(info.remainingDue)}</span> left, due {shortDate(info.dueDate)}
                      </>
                    ) : (
                      " · paid"
                    )}
                  </>
                ) : (
                  "No statement logged yet"
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setPayAccountId(account.id)}
            className="flex items-center justify-center gap-1.5 bg-ledger hover:bg-ledger-dark text-white rounded-lg py-2 text-sm font-medium"
          >
            <ArrowLeftRight size={15} aria-hidden="true" /> Make a payment
          </button>
          <button
            type="button"
            onClick={() => setLogCloseId(account.id)}
            className="flex items-center justify-center gap-1.5 border border-border bg-surface hover:bg-surface-sunken text-ink rounded-lg py-2 text-sm font-medium"
          >
            <CalendarCheck size={15} aria-hidden="true" /> Log statement
          </button>
        </div>
        <div className="flex justify-end gap-1 mt-2">
          <button
            type="button"
            onClick={() => setEditAccountId(account.id)}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink px-2 py-1 rounded-md hover:bg-surface-sunken"
          >
            <Pencil size={12} aria-hidden="true" /> Edit
          </button>
          <ConfirmButton
            onConfirm={() => handleRemove(account.id)}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-alert px-2 py-1 rounded-md hover:bg-alert-soft"
            confirmClassName="text-xs text-white bg-alert px-2 py-1 rounded-md"
            confirmLabel="Delete?"
            title="Delete this liability? Removes its history. Linked transactions survive, unlinked."
          >
            <Trash2 size={12} aria-hidden="true" /> Delete
          </ConfirmButton>
        </div>
      </section>
    );
  };

  return (
    <div data-balances className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h1 className="font-display text-2xl text-ink">Liabilities</h1>
        <div className="flex items-center gap-2">
          <HideBalancesToggle />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-alert hover:bg-alert/90 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            Liability
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

      {isLoaded && liabilities.length === 0 && (
        <p className="text-ink-muted">No liabilities yet. Add a credit card or loan to start tracking what you owe.</p>
      )}

      {liabilities.length > 0 && (
        <>
          <section aria-label="Total owed" className="mb-5">
            <div className="text-xs text-ink-muted uppercase tracking-wide">{isNetCredit ? "Net credit" : "Total owed"}</div>
            <div className={`money font-display text-3xl font-bold ${isNetCredit ? "text-ledger-dark" : "text-alert"}`}>
              {formatCurrency(Math.abs(netBalance))}
            </div>
            {owedChange != null && netBalance !== priorBalance && (
              <p className="text-xs text-ink-muted">
                {owedChange > 0 ? "▲ +" : "▼ -"}
                {Math.abs(owedChange).toFixed(1)}% owed vs last month
              </p>
            )}
          </section>

          {cards.length > 0 && (
            <>
              <section aria-labelledby="glance-title" className="md:hidden bg-surface border border-border rounded-xl mb-4">
                <h2 id="glance-title" className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  At a glance
                </h2>
                <ul className="divide-y divide-border">
                  {cards.map(({ account, status }) => (
                    <li key={account.id}>
                      <button
                        type="button"
                        onClick={() => selectCard(account.id)}
                        aria-current={selected?.account.id === account.id ? "true" : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${
                          selected?.account.id === account.id ? "bg-surface-sunken" : "hover:bg-surface-sunken"
                        }`}
                      >
                        <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{account.name}</span>
                        <StatusPill status={status} />
                        <span className="money text-sm font-semibold text-ink w-24 text-right shrink-0">
                          {formatCurrency(Math.abs(owedOf(account)))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <div
                ref={walletRef}
                className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-3 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-3"
                aria-label="Cards"
              >
                {cards.map(renderVisualCard)}
              </div>

              {selected && <div className="mb-6">{renderDetail(selected)}</div>}
            </>
          )}

          {loans.length > 0 && (
            <section aria-labelledby="loans-title">
              <h2 id="loans-title" className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
                Loans &amp; other
              </h2>
              <ul className="bg-surface border border-border rounded-xl divide-y divide-border">
                {loans.map((loan) => (
                  <li key={loan.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Link to={`/liabilities/${loan.id}`} className="flex-1 min-w-0 text-sm font-medium text-ink truncate hover:underline">
                      {loan.name}
                    </Link>
                    <span className="money text-sm font-semibold text-ink">{formatCurrency(Math.abs(owedOf(loan)))}</span>
                    <button
                      type="button"
                      onClick={() => setPayAccountId(loan.id)}
                      className="text-xs font-medium text-ledger-dark hover:underline"
                    >
                      Pay
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {showAddModal && (
        <AddLiabilityModal onClose={() => setShowAddModal(false)} onCreated={(id) => navigate(`/liabilities/${id}`)} />
      )}
      {editAccountId && <EditLiabilityModal accountId={editAccountId} onClose={() => setEditAccountId(null)} />}
      {payAccountId && <TransferModal accountId={payAccountId} mode="incoming" onClose={() => setPayAccountId(null)} />}
      {logCloseId && <LogStatementCloseModal accountId={logCloseId} onClose={() => setLogCloseId(null)} />}
    </div>
  );
}
