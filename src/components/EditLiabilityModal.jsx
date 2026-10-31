import { useState, useEffect } from "react";
import { CreditCard } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";
import Dialog, { Field, inputClass } from "./Dialog";

export default function EditLiabilityModal({ accountId, onClose }) {
  const { accounts, updateAccount, accountTypes } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [statementCutoffDay, setStatementCutoffDay] = useState("");
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name || "");
      setTypeId(account.typeId ?? null);
      setCreditLimit(account.creditLimit != null ? String(account.creditLimit) : "");
      setStatementCutoffDay(account.statementCutoffDay != null ? String(account.statementCutoffDay) : "");
      setDueDateOffsetDays(account.dueDateOffsetDays != null ? String(account.dueDateOffsetDays) : "");
    }
  }, [account]);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType((newTypeId) => setTypeId(newTypeId));

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a name.");
    if (creditLimit !== "" && (isNaN(Number(creditLimit)) || Number(creditLimit) <= 0))
      return setError("Credit limit must be a positive number, or left blank.");
    if (statementCutoffDay === "" || isNaN(Number(statementCutoffDay)) || Number(statementCutoffDay) < 1 || Number(statementCutoffDay) > 31)
      return setError("Statement cutoff day must be between 1 and 31.");
    if (dueDateOffsetDays === "" || isNaN(Number(dueDateOffsetDays)) || Number(dueDateOffsetDays) < 0)
      return setError("Days until due must be a non-negative number.");

    setSaving(true);
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
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <>
      <Dialog title="Edit Liability" icon={CreditCard} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="edit-liability-name">
            <input id="edit-liability-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Type" htmlFor="edit-liability-type">
            <AccountTypeSelectCell
              id="edit-liability-type"
              value={typeId}
              onChange={setTypeId}
              onRequestAdd={requestAddAccountType}
              accountTypes={accountTypes}
            />
          </Field>

          <Field label="Credit Limit (optional)" htmlFor="edit-liability-limit">
            <input
              id="edit-liability-limit"
              type="text"
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className={`money ${inputClass}`}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Statement Cutoff Day"
              htmlFor="edit-liability-cutoff"
              hint="Used to suggest the date when you log a statement close."
            >
              <input
                id="edit-liability-cutoff"
                type="text"
                inputMode="numeric"
                value={statementCutoffDay}
                onChange={(e) => setStatementCutoffDay(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Days Until Due (after close)" htmlFor="edit-liability-due">
              <input
                id="edit-liability-due"
                type="text"
                inputMode="numeric"
                value={dueDateOffsetDays}
                onChange={(e) => setDueDateOffsetDays(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <p className="text-xs text-ink-muted">
            To change the amount owed, use Reconcile or Transfer from the card&apos;s page - not this form.
          </p>
        </div>
      </Dialog>

      {inlineAddAccountTypeModal}
    </>
  );
}
