import { useState, useMemo } from "react";
import { X, ArrowLeftRight } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";

// Moves units from `accountId` (the source, wherever this modal was opened
// from) to another account of the user's - same currency/unit only.
// Crossing currencies is a Transfer-then-Convert flow instead: move PHP in
// with this modal, then Convert it on the destination account, which
// already handles cost basis and fees properly.
export default function TransferModal({ accountId, onClose }) {
  const { accounts, addTransfer } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const unitLabel = account?.unit || "PHP";

  // Only accounts sharing this account's exact unit are eligible
  // destinations - ordinary PHP accounts all share `unit: null`, so two
  // PHP accounts match each other the same way two USD wallets would.
  const eligibleDestinations = useMemo(
    () => accounts.filter((a) => a.id !== accountId && (a.unit || null) === (account?.unit || null)),
    [accounts, accountId, account]
  );

  const [destinationId, setDestinationId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!destinationId) return setError("Please choose a destination account.");
    if (!date) return setError("Please pick a date.");

    const n = Number(amount);
    if (amount === "" || isNaN(n) || n <= 0)
      return setError(`Please enter a positive amount, in ${unitLabel}.`);

    try {
      await addTransfer(accountId, Number(destinationId), { date, amount: n, comments });
      onClose();
    } catch (err) {
      console.error("Failed to transfer:", err);
      setError(err.message || "Failed to save. Please try again.");
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
          <ArrowLeftRight size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Transfer</h2>
        </div>

        {eligibleDestinations.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No other accounts share this account's currency ({unitLabel}) yet. Add one first, or
            use Convert on this account if what you actually want is to change currencies.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">From</label>
              <div className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface-sunken text-sm">
                {account.name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">To</label>
              <select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
              >
                <option value="">— Choose account —</option>
                {eligibleDestinations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

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
                Amount ({unitLabel})
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. 5000"
              />
            </div>

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
        )}
      </div>
    </div>
  );
}
