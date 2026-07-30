import { useState } from "react";
import { X, CreditCard } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";

// Liabilities (credit cards, etc) reuse the same `accounts` table as
// assets - isLiability true, balance stored negative (0 = paid off, more
// negative = owe more) - see db.js v8 for why that sign convention makes
// every existing balance/transfer/linked-transaction function work
// unmodified. Liabilities are PHP-only for now, same scope restriction as
// Transfer/Convert - no `unit` field here.
export default function AddLiabilityModal({ onClose }) {
  const { addAccount, accountTypes } = useExpenseContext();

  const [name, setName] = useState("");
  const [amountOwed, setAmountOwed] = useState("");
  const [startingDate, setStartingDate] = useState(new Date().toISOString().slice(0, 10));
  const [typeId, setTypeId] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [statementCutoffDay, setStatementCutoffDay] = useState("");
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState("");
  const [error, setError] = useState("");

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType(
    (newTypeId) => setTypeId(newTypeId)
  );

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a name for this card/liability.");
    if (amountOwed === "" || isNaN(Number(amountOwed)))
      return setError(
        "Please enter the current amount owed (0 if it's freshly opened/paid off, negative if you have a credit balance)."
      );
    if (!startingDate) return setError("Please pick a starting date.");
    if (creditLimit !== "" && (isNaN(Number(creditLimit)) || Number(creditLimit) <= 0))
      return setError("Credit limit must be a positive number, or left blank.");
    if (statementCutoffDay === "" || isNaN(Number(statementCutoffDay)) || Number(statementCutoffDay) < 1 || Number(statementCutoffDay) > 31)
      return setError("Please enter a statement cutoff day between 1 and 31 - just a starting guess, the real date each cycle is logged separately.");
    if (dueDateOffsetDays === "" || isNaN(Number(dueDateOffsetDays)) || Number(dueDateOffsetDays) < 0)
      return setError("Please enter how many days after the statement closes payment is due.");

    try {
      await addAccount({
        name: name.trim(),
        // Entered as a signed "amount owed" (negative = credit balance),
        // negated here to match the stored sign convention (positive
        // internal balance = credit in your favor) - see file header.
        // Deliberately NOT Math.abs'd first: that would force every entry
        // into "owed" semantics and silently discard a real overpayment.
        startingBalance: -Number(amountOwed),
        startingDate,
        typeId,
        isLiability: true,
        creditLimit: creditLimit !== "" ? Number(creditLimit) : null,
        statementCutoffDay: Number(statementCutoffDay),
        dueDateOffsetDays: Number(dueDateOffsetDays),
      });
      onClose();
    } catch (err) {
      console.error("Failed to add liability:", err);
      setError("Failed to save.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-alert" />
            <h2 className="font-display text-xl text-ink">Add Liability</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. Visa Card"
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
                Current Amount Owed
              </label>
              <input
                type="text"
                value={amountOwed}
                onChange={(e) => setAmountOwed(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. 15000, 0 if paid off, or -2000 if you have a credit balance"
              />
              <p className="text-xs text-ink-muted mt-1">
                This becomes the card's first reconciliation. Enter a positive number for what you
                owe, or a negative number if you've overpaid and have a credit balance.
              </p>
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
                placeholder="e.g. 100000"
              />
              <p className="text-xs text-ink-muted mt-1">Adjustable anytime from the card's page.</p>
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
                placeholder="e.g. 15"
              />
              <p className="text-xs text-ink-muted mt-1">
                Roughly which day of the month your statement closes - just a starting suggestion.
                Real cutoff dates shift by a day or so around weekends/holidays, so you'll confirm
                the actual date each cycle from the card's page.
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
                placeholder="e.g. 21"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">As Of Date</label>
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
