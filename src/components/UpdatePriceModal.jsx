import { useState } from "react";
import { X, TrendingUp } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";

export default function UpdatePriceModal({ accountId, onClose }) {
  const { accounts, addMarkPrice } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const costCurrencyAccount = account?.costCurrencyAccountId
    ? accounts.find((a) => a.id === account.costCurrencyAccountId)
    : null;
  const costCurrencyLabel = costCurrencyAccount ? costCurrencyAccount.unit : "PHP";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    if (pricePerUnit === "" || isNaN(Number(pricePerUnit)) || Number(pricePerUnit) <= 0)
      return setError("Please enter a valid price.");

    try {
      await addMarkPrice(accountId, {
        date,
        pricePerUnit: Number(pricePerUnit),
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to update price:", err);
      setError("Failed to save. Please try again.");
    }
  };

  if (!account) return null;

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
          <TrendingUp size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Update Price</h2>
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
              Price ({costCurrencyLabel} per {account.unit})
            </label>
            <input
              type="text"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 58.00"
            />
            <p className="text-xs text-ink-muted mt-1">
              A pure valuation snapshot - doesn't change how many {account.unit} you hold, only
              what they're worth.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Comments (optional)
            </label>
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
