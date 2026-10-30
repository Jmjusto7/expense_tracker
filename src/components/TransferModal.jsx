import { useState, useMemo } from "react";
import { X, ArrowLeftRight } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";

// Moves units between `accountId` (wherever this modal was opened from)
// and another account of the user's - same currency/unit only. Crossing
// currencies is a Convert instead - pick this account as Convert's
// Funding Source on the destination account, which debits it directly
// (and handles cost basis and fees) in the same action.
//
// fee (optional): a same-currency transfer can still cost something (a
// wire fee, a deposit fee) - see addTransfer for how it's applied and
// auto-logged.
//
// `mode="outgoing"` (default): accountId is the source, fixed as "From";
// pick a destination. `mode="incoming"`: accountId is the destination,
// fixed as "To"; pick a source. Paying off a liability needs the latter -
// a liability shares `unit: null` with ordinary PHP accounts, so it's
// already an eligible counterpart either direction, and the destination
// leg's positive amount is what reduces how negative the card's balance
// is, regardless of which side of the form it's shown on.
export default function TransferModal({ accountId, onClose, mode = "outgoing" }) {
  const { accounts, addTransfer, categories } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);
  const isIncoming = mode === "incoming";

  const unitLabel = account?.unit || "PHP";

  // Only accounts sharing this account's exact unit are eligible
  // counterparts - ordinary PHP accounts all share `unit: null`, so two
  // PHP accounts match each other the same way two USD wallets would.
  const eligibleCounterparts = useMemo(
    () => accounts.filter((a) => a.id !== accountId && (a.unit || null) === (account?.unit || null)),
    [accounts, accountId, account]
  );

  const [counterpartId, setCounterpartId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [feeCategory, setFeeCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!counterpartId) return setError(`Please choose ${isIncoming ? "which account this is coming from" : "a destination account"}.`);
    if (!date) return setError("Please pick a date.");

    const n = Number(amount);
    if (amount === "" || isNaN(n) || n <= 0)
      return setError(`Please enter a positive amount, in ${unitLabel}.`);

    if (fee !== "" && (isNaN(Number(fee)) || Number(fee) < 0))
      return setError(`Please enter a valid fee, in ${unitLabel}, or leave it blank.`);

    if (fee !== "" && Number(fee) >= n)
      return setError("The fee must be less than the transfer amount.");

    try {
      const fromId = isIncoming ? counterpartId : accountId;
      const toId = isIncoming ? accountId : counterpartId;
      await addTransfer(fromId, toId, {
        date,
        amount: n,
        comments,
        fee: fee !== "" ? Number(fee) : null,
        feeCategory: feeCategory.trim() || null,
      });
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
          <h2 className="font-display text-xl text-ink">{isIncoming ? "Make a Payment" : "Transfer"}</h2>
        </div>

        {eligibleCounterparts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No other accounts share this account's currency ({unitLabel}) yet. Add one first, or
            use Convert on this account if what you actually want is to change currencies.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {!isIncoming && (
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">From</label>
                <div className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface-sunken text-sm">
                  {account.name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {isIncoming ? "From" : "To"}
              </label>
              <select
                value={counterpartId}
                onChange={(e) => setCounterpartId(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
              >
                <option value="">— Choose account —</option>
                {eligibleCounterparts.filter((a) => !a.isLiability).length > 0 && (
                  <optgroup label="Assets">
                    {eligibleCounterparts
                      .filter((a) => !a.isLiability)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {eligibleCounterparts.filter((a) => a.isLiability).length > 0 && (
                  <optgroup label="Liabilities">
                    {eligibleCounterparts
                      .filter((a) => a.isLiability)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {isIncoming && (
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">To</label>
                <div className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface-sunken text-sm">
                  {account.name}
                </div>
              </div>
            )}

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
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Fee (optional, in {unitLabel})
              </label>
              <input
                type="text"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. 50"
              />
              <p className="text-xs text-ink-muted mt-1">
                What actually arrives is Amount − Fee - the fee itself gets auto-logged as an
                expense.
              </p>
            </div>

            {fee !== "" && Number(fee) > 0 && (
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">Fee Category</label>
                <CategoryAutocompleteInput
                  value={feeCategory}
                  onChange={setFeeCategory}
                  categories={categories}
                />
                <p className="text-xs text-ink-muted mt-1">Defaults to "Fees" if left blank.</p>
              </div>
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
        )}
      </div>
    </div>
  );
}
