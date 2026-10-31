import { useState } from "react";
import { Tags } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import Dialog, { Field } from "./Dialog";

export default function AddAccountTypeModal({ onClose, onCreated }) {
  const { addAccountType, accountTypes } = useExpenseContext();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const existingMatch = accountTypes.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a type name.");

    setSaving(true);
    try {
      const newTypeId = await addAccountType(name.trim());
      onCreated?.(newTypeId);
      onClose();
    } catch (err) {
      console.error("Failed to add account type:", err);
      setError("Failed to save.");
      setSaving(false);
    }
  };

  return (
    <Dialog title="Add Account Type" icon={Tags} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
      <Field label="Type Name" htmlFor="account-type-name" hint="Press Tab to complete a suggested name.">
        <CategoryAutocompleteInput
          id="account-type-name"
          value={name}
          onChange={setName}
          categories={accountTypes.map((t) => t.name)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </Field>
      {existingMatch && name.trim() && (
        <p className="text-xs text-ledger-dark mt-2">
          &quot;{existingMatch.name}&quot; already exists - saving will use it rather than create a duplicate.
        </p>
      )}
    </Dialog>
  );
}
