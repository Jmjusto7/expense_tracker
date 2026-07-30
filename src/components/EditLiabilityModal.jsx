import { useState, useEffect } from "react";
import { X, CreditCard } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";

export default function EditLiabilityModal({ accountId, onClose }) {
  const { accounts, updateAccount, accountTypes } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [statementCutoffDay, setStatementCutoffDay] = useState("");
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (account) {
      setName(account.name || "");
      setTypeId(account.typeId ?? null);
      setCreditLimit(account.creditLimit != null ? String(account.creditLimit) : "");
      setStatementCutoffDay(account.statementCutoffDay != null ? String(account.statementCutoffDay) : "");
      setDueDateOffsetDays(account.dueDateOffsetDays != null ? String(account.dueDateOffsetDays) : "");
    }
  }, [account]);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType(
    (newTypeId) => setTypeId(newTypeId)
  );

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a name.");
    if (creditLimit !== "" && (isNaN(Number(creditLimit)) || Number(creditLimit) <= 0))
      return setError("Credit limit must be a positive number, or left blank.");
    if (statementCutoffDay === "" || isNaN(Number(statementCutoffDay)) || Number(statementCutoffDay) < 1 || Number(statementCutoffDay) > 31)
      return setError("Statement cutoff day must be between 1 and 31.");
    if (dueDateOffsetDays === "" || isNaN(Number(dueDateOffsetDays)) || Number(dueDateOffsetDays) < 0)
      return setError("Days until due must be a non-negative number.");

    try {
      await updateAccount(accountId, {
        name: name.trim(),
        typeId,
        creditLimit: creditLimit !== "" ? Number(creditLimit) : null,
        statementCutoffDay: Number(statementCutoffDay),
        dueDateOffsetDays: Number(dueDateOffsetDays),
      });
      onClose();
    } catch (err) {
      console.error("Failed to update liability:", err);
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
            <CreditCard size={18} className="text-alert" />
            <h2 className="font-display text-xl text-ink">Edit Liability</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Type</label>
              <AccountTypeSelectCell
                value={typeId}
                onChange={setTypeId}
                onRequestAdd={requestAddAccountType}
                accountTypes={accountTypes}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Credit Limit (optional)
              </label>
              <input
                type="text"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Statement Cutoff Day
              </label>
              <input
                type="text"
                value={statementCutoffDay}
                onChange={(e) => setStatementCutoffDay(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
              <p className="text-xs text-ink-muted mt-1">
                Just a suggestion used to prefill the date when you log a statement close - not
                the authoritative cutoff itself.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Days Until Due (after statement closes)
              </label>
              <input
                type="text"
                value={dueDateOffsetDays}
                onChange={(e) => setDueDateOffsetDays(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
            </div>

            <p className="text-xs text-ink-muted">
              To change the amount owed, use Reconcile or Transfer from the card's page - not this
              form.
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
