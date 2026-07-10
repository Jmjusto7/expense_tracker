import { useState, useEffect } from "react";
import { X, Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";

export default function EditAccountModal({ accountId, onClose }) {
  const { accounts, updateAccount, accountTypes } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (account) {
      setName(account.name || "");
      setTypeId(account.typeId ?? null);
    }
  }, [account]);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType(
    (newTypeId) => setTypeId(newTypeId)
  );

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter an account name.");

    try {
      await updateAccount(accountId, { name: name.trim(), typeId });
      onClose();
    } catch (err) {
      console.error("Failed to update account:", err);
      setError("Failed to save changes.");
    }
  };

  if (!account) return null;

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
            <h2 className="font-display text-xl text-ink">Edit Account</h2>
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

            <p className="text-xs text-ink-muted">
              To change the balance itself, use Add Income or Reconcile Balance from
              the account page - not this form.
            </p>

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
