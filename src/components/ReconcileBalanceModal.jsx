import { useState, useMemo } from "react";
import { X, Scale } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { getBalanceAsOf } from "../utils/balanceHelpers";
import { formatCurrency } from "../utils/formatCurrency";

export default function ReconcileBalanceModal({ accountId, onClose }) {
  const { balanceEntries, addReconciliation } = useExpenseContext();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [actualBalance, setActualBalance] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  // "Book" balance as of the date being reconciled - computed live from
  // whatever's already logged (anchor reconciliation + income since). This
  // is never stored; it's purely a preview so the delta below is
  // self-documenting rather than a bare number entry.
  const bookBalance = useMemo(() => {
    if (!date) return null;
    return getBalanceAsOf(balanceEntries, accountId, new Date(date));
  }, [balanceEntries, accountId, date]);

  const actualNum = actualBalance === "" ? null : Number(actualBalance);
  const delta =
    actualNum !== null && !isNaN(actualNum) && bookBalance !== null
      ? actualNum - bookBalance
      : null;

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    if (actualBalance === "" || isNaN(Number(actualBalance)))
      return setError("Please enter the actual balance you see.");

    try {
      await addReconciliation(accountId, {
        date,
        balance: Number(actualBalance),
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to reconcile balance:", err);
      setError("Failed to save. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Scale size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Reconcile Balance</h2>
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

          <div className="bg-surface-sunken rounded-md px-3 py-2 flex justify-between items-center">
            <span className="text-sm text-ink-muted">
              Book balance (income logged so far)
            </span>
            <span className="money text-sm font-semibold text-ink">
              {bookBalance === null ? "—" : formatCurrency(bookBalance)}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              What does your account actually show?
            </label>
            <input
              type="text"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 18000"
            />
          </div>

          {delta !== null && (
            <div
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                delta < 0
                  ? "bg-alert-soft text-alert"
                  : delta > 0
                    ? "bg-ledger-soft text-ledger-dark"
                    : "bg-surface-sunken text-ink-muted"
              }`}
            >
              {delta < 0 &&
                `Implied spend since last reconciliation: ${formatCurrency(Math.abs(delta))}`}
              {delta > 0 &&
                `Unaccounted inflow since last reconciliation: ${formatCurrency(delta)}`}
              {delta === 0 && "Matches the book balance exactly - no gap."}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Comments (optional)
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. Bank fee, interest, cash withdrawal"
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
