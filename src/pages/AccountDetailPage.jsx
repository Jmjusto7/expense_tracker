import { useParams } from "react-router-dom";
import { useState } from "react";
import { Wallet, TrendingUp, Scale, Trash2, ArrowRightLeft, ArrowLeftRight } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";
import {
  getCurrentBalance,
  getCurrentValuePhp,
  getValueInCostCurrency,
  getAverageCost,
  getLatestPrice,
  getUnrealizedGainLoss,
  buildInvestmentHistory,
  daysSinceLastReconciliation,
  getImpliedSpendPeriods,
  getAccountEntriesSorted,
} from "../utils/balanceHelpers";
import AccountBalanceChart from "../components/AccountBalanceChart";
import InvestmentGrowthChart from "../components/InvestmentGrowthChart";
import AddIncomeModal from "../components/AddIncomeModal";
import ReconcileBalanceModal from "../components/ReconcileBalanceModal";
import ConvertModal from "../components/ConvertModal";
import UpdatePriceModal from "../components/UpdatePriceModal";
import TransferModal from "../components/TransferModal";
import ConfirmButton from "../components/ConfirmButton";
import StatCard from "../components/StatCard";
import Breadcrumbs from "../components/Breadcrumbs";

const formatNumber = (n, maxFractionDigits = 2) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const { accounts, balanceEntries, removeBalanceEntry } = useExpenseContext();

  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showUpdatePrice, setShowUpdatePrice] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const account = accounts.find((a) => String(a.id) === accountId);
  const currentAccountId = account?.id;

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-alert">Account not found.</p>
      </div>
    );
  }

  const isForeign = account.unit != null;

  const costCurrencyAccount = account.costCurrencyAccountId
    ? accounts.find((a) => a.id === account.costCurrencyAccountId)
    : null;
  const costCurrencyLabel = costCurrencyAccount ? costCurrencyAccount.unit : "PHP";

  const currentBalance = getCurrentBalance(balanceEntries, currentAccountId);
  const phpValue = isForeign ? getCurrentValuePhp(balanceEntries, accounts, currentAccountId) : currentBalance;

  const avgCost = isForeign ? getAverageCost(balanceEntries, currentAccountId) : null;
  const currentPrice = isForeign ? getLatestPrice(balanceEntries, currentAccountId) : null;
  const gainLoss = isForeign ? getUnrealizedGainLoss(balanceEntries, currentAccountId) : null;

  // Only worth showing as its own line when it's a genuinely different
  // number from phpValue above - a one-hop account (costCurrencyLabel ===
  // "PHP") already has its cost-currency value AND PHP value be the same
  // figure, so this is specifically for two-hop accounts like VOO (priced
  // in IBKR USD, which is itself priced in PHP) where "worth in USD" and
  // "worth in PHP" are two genuinely different, both-useful numbers.
  const costCurrencyValue = isForeign ? getValueInCostCurrency(balanceEntries, currentAccountId) : null;
  const showCostCurrencyValue = isForeign && costCurrencyLabel !== "PHP";

  const investmentHistory = isForeign ? buildInvestmentHistory(balanceEntries, currentAccountId) : [];

  const staleDays = daysSinceLastReconciliation(balanceEntries, currentAccountId);
  const periods = getImpliedSpendPeriods(balanceEntries, currentAccountId);
  const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  // Most recent first, for the history table. Excludes "expense" - the
  // shadow entry auto-generated for a transaction linked via "Paid From"
  // (see ExpenseContext's syncShadowExpenseEntry) - since that spend is
  // already visible on the Expenses tab; History stays limited to actions
  // taken directly on this account (income, reconcile, convert, transfer,
  // price updates).
  const entries = getAccountEntriesSorted(balanceEntries, currentAccountId)
    .filter((e) => e.type !== "expense")
    .slice()
    .reverse();

  const balanceColor = phpValue != null && phpValue < 0 ? "text-alert" : "text-ledger-dark";

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
    t === "income"
      ? "Income"
      : t === "convert"
        ? "Converted"
        : t === "markPrice"
          ? "Price Update"
          : t === "transfer"
            ? "Transfer"
            : "Reconciled";

  const typeBadgeClass = (t) => {
    if (t === "markPrice" || t === "transfer") return "bg-surface-sunken text-ink-muted border-border";
    if (t === "reconciliation") return "bg-travel-soft text-travel-dark border-travel/30";
    return "bg-ledger-soft text-ledger-dark border-ledger/30"; // income / convert
  };

  const formatEntryValue = (e) => {
    if (!isForeign) {
      if (e.type === "income") return formatCurrency(e.amount);
      if (e.type === "reconciliation") return formatCurrency(e.balance);
      if (e.type === "transfer") return `${e.amount >= 0 ? "+" : ""}${formatCurrency(e.amount)}`;
      return "—";
    }
    if (e.type === "convert") return `${formatNumber(e.amount, 4)} ${account.unit}`;
    if (e.type === "reconciliation") return `${formatNumber(e.balance, 4)} ${account.unit}`;
    if (e.type === "markPrice") return `${formatNumber(e.pricePerUnit, 4)} ${costCurrencyLabel}/${account.unit}`;
    if (e.type === "transfer") return `${e.amount >= 0 ? "+" : ""}${formatNumber(e.amount, 4)} ${account.unit}`;
    return "—";
  };

  const entrySupplementalNote = (e) => {
    if (e.type === "convert") {
      const parts = [`Cost: ${formatNumber(e.costBasis)} ${costCurrencyLabel}`];
      if (e.fee) parts.push(`Fee: ${formatNumber(e.fee)} ${costCurrencyLabel}`);
      return parts.join(" · ");
    }
    if (e.type === "transfer") {
      const counterpart = accounts.find((a) => a.id === e.counterpartAccountId);
      const name = counterpart?.name || "a deleted account";
      return e.amount < 0 ? `→ ${name}` : `← ${name}`;
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs items={[{ label: "Assets", to: "/assets" }, { label: account.name }]} />

      <div className="mt-3 mb-6">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-ledger-dark" />
          <h1 className="font-display text-2xl text-ink">{account.name}</h1>
        </div>

        {isForeign ? (
          <>
            <div className="money text-2xl font-bold mt-2 text-ink">
              {currentBalance == null ? "—" : `${formatNumber(currentBalance, 4)} ${account.unit}`}
            </div>
            {showCostCurrencyValue && (
              <div className="money text-lg font-semibold mt-1 text-ink">
                {costCurrencyValue == null ? "≈ — (no price recorded yet)" : `≈ ${formatNumber(costCurrencyValue)} ${costCurrencyLabel}`}
              </div>
            )}
            <div className={`money text-sm mt-0.5 ${balanceColor}`}>
              {phpValue == null ? "≈ — (no price recorded yet)" : `≈ ${formatCurrency(phpValue)} today`}
            </div>
          </>
        ) : (
          <div className={`money text-2xl font-bold mt-2 ${balanceColor}`}>
            {phpValue == null ? "—" : formatCurrency(phpValue)}
          </div>
        )}

        <div className="text-xs text-ink-muted mt-1">
          {staleDays === null
            ? "Not reconciled yet"
            : staleDays === 0
              ? "As of today"
              : `As of ${staleDays} day${staleDays === 1 ? "" : "s"} ago - projected forward since then`}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {isForeign ? (
          <>
            <button
              onClick={() => setShowConvert(true)}
              className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <ArrowRightLeft size={15} />
              Convert
            </button>
            <button
              onClick={() => setShowUpdatePrice(true)}
              className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <TrendingUp size={15} />
              Update Price
            </button>
            <button
              onClick={() => setShowReconcile(true)}
              className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Scale size={15} />
              Reconcile Units
            </button>
          </>
        ) : (
          <>
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
          </>
        )}

        {/* Transfer applies equally to PHP and foreign accounts - moving
            units to another account of the same currency/unit - so it
            lives outside the isForeign branch above rather than being
            duplicated in both. */}
        <button
          onClick={() => setShowTransfer(true)}
          className="flex items-center gap-2 border border-border hover:bg-surface-sunken text-ink px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowLeftRight size={15} />
          Transfer
        </button>
      </div>

      {isForeign && (
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Total Invested"
            value={gainLoss == null ? "—" : `${formatNumber(gainLoss.totalCostBasis)} ${costCurrencyLabel}`}
            sublabel="Sum of every purchase's cost basis"
          />
          <StatCard
            label="Current Value"
            value={gainLoss == null ? "—" : `${formatNumber(gainLoss.currentValue)} ${costCurrencyLabel}`}
            sublabel="Units held x current price"
          />
          <StatCard
            label="Gain / Loss"
            value={
              gainLoss == null
                ? "—"
                : `${gainLoss.gainLoss >= 0 ? "+" : ""}${formatNumber(gainLoss.gainLoss)} ${costCurrencyLabel}`
            }
            sublabel={gainLoss?.pct != null ? `${gainLoss.pct >= 0 ? "+" : ""}${gainLoss.pct.toFixed(1)}% since inception` : "In " + costCurrencyLabel + ", not PHP"}
            accent={gainLoss && gainLoss.gainLoss < 0 ? "alert" : "ledger"}
          />
        </div>
      )}

      {/* Average Cost / Current Price - foreign accounts only, deliberately
          shown in the account's own cost currency, never translated to PHP
          (see foreign-assets-plan.md §3). Gain/Loss's dollar figures moved
          up to the Total Invested / Current Value row above - this row is
          now just the per-unit reference numbers. */}
      {isForeign && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <StatCard
            label="Average Cost"
            value={avgCost == null ? "—" : `${formatNumber(avgCost, 4)} ${costCurrencyLabel}/${account.unit}`}
          />
          <StatCard
            label="Current Price"
            value={currentPrice == null ? "—" : `${formatNumber(currentPrice, 4)} ${costCurrencyLabel}/${account.unit}`}
          />
        </div>
      )}

      {lastPeriod && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <StatCard
            label={lastPeriod.impliedSpend < 0 ? "Unaccounted Inflow (last period)" : "Implied Spend (last period)"}
            value={
              isForeign
                ? `${formatNumber(Math.abs(lastPeriod.impliedSpend), 4)} ${account.unit}`
                : formatCurrency(Math.abs(lastPeriod.impliedSpend))
            }
            sublabel={`${formatDate(lastPeriod.fromDate)} – ${formatDate(lastPeriod.toDate)}`}
            accent={lastPeriod.impliedSpend < 0 ? "ledger" : "alert"}
          />
          <StatCard
            label={isForeign ? "Units Added (last period)" : "Inflow Logged (last period)"}
            value={
              isForeign
                ? `${formatNumber(lastPeriod.incomeInPeriod, 4)} ${account.unit}`
                : formatCurrency(lastPeriod.incomeInPeriod)
            }
            sublabel="Income + transfers in, between those two reconciliations"
          />
        </div>
      )}

      <div className="bg-surface rounded-lg border border-border p-6 mb-6">
        <div className="text-xs text-ink-muted uppercase tracking-wide mb-3">
          {isForeign ? "Units Over Time" : "Balance Over Time"}
        </div>
        <AccountBalanceChart entries={balanceEntries} accountId={currentAccountId} unit={account.unit} />
      </div>

      {isForeign && investmentHistory.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6 mb-6">
          <div className="text-xs text-ink-muted uppercase tracking-wide mb-3">
            Total Invested vs Current Value
          </div>
          <InvestmentGrowthChart data={investmentHistory} unitLabel={costCurrencyLabel} />
        </div>
      )}

      <div className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">History</h2>

        {deleteError && (
          <p className="text-alert text-sm bg-alert-soft rounded-md px-3 py-2 mb-3">
            {deleteError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
                <th className="border border-border px-3 py-2 font-medium">Date</th>
                <th className="border border-border px-3 py-2 font-medium">Type</th>
                {!isForeign && <th className="border border-border px-3 py-2 font-medium">Category</th>}
                <th className="border border-border px-3 py-2 text-right font-medium">
                  {isForeign ? "Units / Price" : "Amount / Balance"}
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
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadgeClass(e.type)}`}>
                      {typeLabel(e.type)}
                    </span>
                  </td>
                  {!isForeign && (
                    <td className="border border-border px-3 py-2 text-ink">{e.category || "—"}</td>
                  )}
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
        </div>

        {entries.length === 0 && (
          <p className="text-ink-muted text-sm text-center py-6">No entries yet.</p>
        )}
      </div>

      {showAddIncome && (
        <AddIncomeModal accountId={currentAccountId} onClose={() => setShowAddIncome(false)} />
      )}

      {showConvert && (
        <ConvertModal accountId={currentAccountId} onClose={() => setShowConvert(false)} />
      )}

      {showUpdatePrice && (
        <UpdatePriceModal accountId={currentAccountId} onClose={() => setShowUpdatePrice(false)} />
      )}

      {showReconcile && (
        <ReconcileBalanceModal accountId={currentAccountId} onClose={() => setShowReconcile(false)} />
      )}

      {showTransfer && (
        <TransferModal accountId={currentAccountId} onClose={() => setShowTransfer(false)} />
      )}
    </div>
  );
}
