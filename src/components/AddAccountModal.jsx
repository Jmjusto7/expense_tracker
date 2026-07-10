import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";

export default function AddAccountModal({ onClose }) {
  const { addAccount, accountTypes } = useExpenseContext();

  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [startingDate, setStartingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [typeId, setTypeId] = useState(null);
  const [error, setError] = useState("");

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType(
    (newTypeId) => setTypeId(newTypeId)
  );

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter an account name.");
    if (startingBalance === "" || isNaN(Number(startingBalance)))
      return setError("Please enter a valid starting balance.");
    if (!startingDate) return setError("Please pick a starting date.");

    try {
      await addAccount({
        name: name.trim(),
        startingBalance: Number(startingBalance),
        startingDate,
        typeId,
      });
      onClose();
    } catch (err) {
      console.error("Failed to add account:", err);
      setError("Failed to save account.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-ledger-dark" />
            <h2 className="font-display text-xl text-ink">Add Account</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="Bank A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Type
              </label>
              <AccountTypeSelectCell
                value={typeId}
                onChange={setTypeId}
                onRequestAdd={requestAddAccountType}
                accountTypes={accountTypes}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Starting Balance
              </label>
              <input
                type="text"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. 10000"
              />
              <p className="text-xs text-ink-muted mt-1">
                This becomes the account's first reconciliation - the starting point
                everything else builds from.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                As Of Date
              </label>
              <input
                type="date"
                value={startingDate}
                onChange={(e) => setStartingDate(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
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

      {inlineAddAccountTypeModal}
    </>
  );
}
