import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";
import Dialog, { Field, inputClass } from "./Dialog";

export default function EditAccountModal({ accountId, onClose }) {
  const { accounts, updateAccount, accountTypes } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name || "");
      setTypeId(account.typeId ?? null);
    }
  }, [account]);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType((newTypeId) => setTypeId(newTypeId));

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter an account name.");

    setSaving(true);
    try {
      await updateAccount(accountId, { name: name.trim(), typeId });
      onClose();
    } catch (err) {
      console.error("Failed to update account:", err);
      setError("Failed to save changes.");
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <>
      <Dialog title="Edit Account" icon={Wallet} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
        <div className="flex flex-col gap-4">
          <Field label="Account Name" htmlFor="edit-account-name">
            <input id="edit-account-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Type" htmlFor="edit-account-type">
            <AccountTypeSelectCell
              id="edit-account-type"
              value={typeId}
              onChange={setTypeId}
              onRequestAdd={requestAddAccountType}
              accountTypes={accountTypes}
            />
          </Field>

          <p className="text-xs text-ink-muted">
            To change the balance itself, use Add Income or Reconcile Balance from the account page - not this form.
          </p>
        </div>
      </Dialog>

      {inlineAddAccountTypeModal}
    </>
  );
}
