import { useState } from "react";
import { X, CalendarCheck } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { suggestNextCutoffDate } from "../utils/balanceHelpers";

// Logs the actual date a liability's statement closed - a real dated fact
// the user confirms each cycle, not something computed (see db.js v8 /
// getStatementCloseEntries). The date field prefills from
// statementCutoffDay as a convenience, but is always editable and never
// auto-saved without confirmation - same spirit as ReconcileBalanceModal
// showing a "book" preview but never trusting it blindly.
export default function LogStatementCloseModal({ accountId, onClose }) {
  const { accounts, addStatementClose } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const suggested = account?.statementCutoffDay
    ? suggestNextCutoffDate(account.statementCutoffDay)
    : new Date();

  const [date, setDate] = useState(suggested.toISOString().slice(0, 10));
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!date) return setError("Please pick the date this statement actually closed.");

    try {
      await addStatementClose(accountId, { date, comments });
      onClose();
    } catch (err) {
      console.error("Failed to log statement close:", err);
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
          <CalendarCheck size={18} className="text-alert" />
          <h2 className="font-display text-xl text-ink">Log Statement Close</h2>
        </div>

        <p className="text-sm text-ink-muted mb-4">
          Confirm the actual date this statement closed - prefilled as a guess based on the
          card's usual cutoff day, but adjust it if the real date shifted (weekends, holidays,
          short months, etc).
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Cutoff Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
            />
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
