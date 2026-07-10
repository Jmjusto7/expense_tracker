import { useState } from "react";
import { X, Tags } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";

export default function AddAccountTypeModal({ onClose, onCreated }) {
  const { addAccountType, accountTypes } = useExpenseContext();

  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const existingMatch = accountTypes.find(
    (t) => t.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a type name.");

    try {
      const newTypeId = await addAccountType(name.trim());
      onCreated?.(newTypeId);
      onClose();
    } catch (err) {
      console.error("Failed to add account type:", err);
      setError("Failed to save.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div className="bg-surface w-[90%] max-w-sm rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Tags size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Add Account Type</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Type Name</label>
            <CategoryAutocompleteInput
              value={name}
              onChange={setName}
              categories={accountTypes.map((t) => t.name)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-xs text-ink-muted mt-1">Press Tab to complete a suggested name.</p>
            {existingMatch && name.trim() && (
              <p className="text-xs text-ledger-dark mt-1">
                "{existingMatch.name}" already exists - saving will use it rather than create a duplicate.
              </p>
            )}
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
