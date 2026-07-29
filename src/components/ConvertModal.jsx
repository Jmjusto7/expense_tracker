import { useState, useMemo } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { getCurrentBalance, getCurrentValuePhp } from "../utils/balanceHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";

export default function ConvertModal({ accountId, onClose }) {
  const { accounts, balanceEntries, addConvertEntry, categories } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const costCurrencyAccount = account?.costCurrencyAccountId
    ? accounts.find((a) => a.id === account.costCurrencyAccountId)
    : null;
  const costCurrencyLabel = costCurrencyAccount ? costCurrencyAccount.unit : "PHP";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [costBasis, setCostBasis] = useState("");
  const [unitsReceived, setUnitsReceived] = useState("");
  const [fee, setFee] = useState("");
  const [feeCategory, setFeeCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const impliedRate = useMemo(() => {
    const cost = Number(costBasis);
    const units = Number(unitsReceived);
    if (!cost || !units) return null;
    return cost / units;
  }, [costBasis, unitsReceived]);

  // Live preview of what the fee will actually log as, converted to PHP if
  // this account's cost currency isn't already PHP - same chained rate the
  // account's own valuation uses, so the preview matches what actually gets
  // written.
  const feePhpPreview = useMemo(() => {
    const feeNum = Number(fee);
    if (!feeNum) return null;
    if (!account?.costCurrencyAccountId) return feeNum;

    const refUnits = getCurrentBalance(balanceEntries, account.costCurrencyAccountId, new Date(date));
    const refValuePhp = getCurrentValuePhp(balanceEntries, accounts, account.costCurrencyAccountId, new Date(date));
    if (!refUnits || refValuePhp == null) return null;
    return feeNum * (refValuePhp / refUnits);
  }, [fee, account, balanceEntries, accounts, date]);

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    const cost = Number(costBasis);
    const units = Number(unitsReceived);
    if (!costBasis || isNaN(cost) || cost <= 0)
      return setError(`Please enter what you spent, in ${costCurrencyLabel}.`);
    if (!unitsReceived || isNaN(units) || units <= 0)
      return setError("Please enter the units received.");

    try {
      await addConvertEntry(accountId, {
        date,
        amount: units,
        costBasis: cost,
        fee: fee !== "" ? Number(fee) : null,
        feeCategory: feeCategory.trim() || null,
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to save conversion:", err);
      setError("Failed to save. Please try again.");
    }
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Convert</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {costCurrencyLabel} Spent
            </label>
            <input
              type="text"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 56500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              {account.unit} Received
            </label>
            <input
              type="text"
              value={unitsReceived}
              onChange={(e) => setUnitsReceived(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 1000"
            />
          </div>

          {impliedRate !== null && (
            <div className="bg-surface-sunken rounded-md px-3 py-2 flex justify-between items-center text-sm">
              <span className="text-ink-muted">Implied rate</span>
              <span className="money font-semibold text-ink">
                {impliedRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {costCurrencyLabel}/{account.unit}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Fee (optional, in {costCurrencyLabel})
            </label>
            <input
              type="text"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 200"
            />
          </div>

          {fee !== "" && Number(fee) > 0 && (
            <>
              <div className="bg-ledger-soft rounded-md px-3 py-2 text-sm text-ledger-dark">
                {feePhpPreview !== null
                  ? `Will log an expense: ${formatCurrency(feePhpPreview)}${
                      costCurrencyAccount ? ` (${fee} ${costCurrencyLabel} converted)` : ""
                    }`
                  : "Can't preview yet - this account has no price/rate history to convert the fee with."}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  Fee Category
                </label>
                <CategoryAutocompleteInput
                  value={feeCategory}
                  onChange={setFeeCategory}
                  categories={categories}
                />
                <p className="text-xs text-ink-muted mt-1">Defaults to "Fees" if left blank.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Comments</label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
            />
          </div>

          {error && <p className="text-alert text-sm">{error}</p>}

          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={onClose}
              className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
