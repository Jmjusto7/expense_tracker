import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toDateInputValue } from "../utils/dateHelpers";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";
import Dialog, { Field, inputClass } from "./Dialog";

// Liabilities (credit cards, etc) reuse the same `accounts` table as
// assets - isLiability true, balance stored negative (0 = paid off, more
// negative = owe more) - see db.js v8. PHP-only for now.
export default function AddLiabilityModal({ onClose, onCreated }) {
  const { addAccount, accountTypes } = useExpenseContext();

  const [name, setName] = useState("");
  const [amountOwed, setAmountOwed] = useState("");
  const [startingDate, setStartingDate] = useState(toDateInputValue());
  const [typeId, setTypeId] = useState(null);
  const [creditLimit, setCreditLimit] = useState("");
  const [statementCutoffDay, setStatementCutoffDay] = useState("");
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType((newTypeId) => setTypeId(newTypeId));

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter a name for this card/liability.");
    if (amountOwed !== "" && isNaN(Number(amountOwed)))
      return setError("Amount owed must be a number (negative if you have a credit balance), or left blank for 0.");
    if (!startingDate) return setError("Please pick a starting date.");
    if (creditLimit !== "" && (isNaN(Number(creditLimit)) || Number(creditLimit) <= 0))
      return setError("Credit limit must be a positive number, or left blank.");
    if (statementCutoffDay === "" || isNaN(Number(statementCutoffDay)) || Number(statementCutoffDay) < 1 || Number(statementCutoffDay) > 31)
      return setError("Please enter a statement cutoff day between 1 and 31 - just a starting guess, the real date each cycle is logged separately.");
    if (dueDateOffsetDays === "" || isNaN(Number(dueDateOffsetDays)) || Number(dueDateOffsetDays) < 0)
      return setError("Please enter how many days after the statement closes payment is due.");

    setSaving(true);
    try {
      const id = await addAccount({
        name: name.trim(),
        // Signed "amount owed" (negative = credit balance), negated to the stored convention.
        startingBalance: -Number(amountOwed || 0),
        startingDate,
        typeId,
        isLiability: true,
        creditLimit: creditLimit !== "" ? Number(creditLimit) : null,
        statementCutoffDay: Number(statementCutoffDay),
        dueDateOffsetDays: Number(dueDateOffsetDays),
      });
      onClose();
      onCreated?.(id);
    } catch (err) {
      console.error("Failed to add liability:", err);
      setError("Failed to save.");
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        title="Add Liability"
        icon={CreditCard}
        onClose={onClose}
        onSubmit={handleSave}
        busy={saving}
        error={error}
        submitClassName="bg-alert hover:bg-alert/90"
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="liability-name">
            <input
              id="liability-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Visa Card"
            />
          </Field>

          <Field label="Type" htmlFor="liability-type">
            <AccountTypeSelectCell
              id="liability-type"
              value={typeId}
              onChange={setTypeId}
              onRequestAdd={requestAddAccountType}
              accountTypes={accountTypes}
            />
          </Field>

          <Field
            label="Current Amount Owed"
            htmlFor="liability-owed"
            hint="Becomes the first reconciliation. Leave blank for 0; negative if you have a credit balance."
          >
            <input
              id="liability-owed"
              type="text"
              inputMode="decimal"
              value={amountOwed}
              onChange={(e) => setAmountOwed(e.target.value)}
              className={`money ${inputClass}`}
              placeholder="e.g. 15000"
            />
          </Field>

          <Field label="Credit Limit (optional)" htmlFor="liability-limit" hint="Adjustable anytime from the card's page.">
            <input
              id="liability-limit"
              type="text"
              inputMode="decimal"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className={`money ${inputClass}`}
              placeholder="e.g. 100000"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Statement Cutoff Day"
              htmlFor="liability-cutoff"
              hint="Roughly which day the statement closes; you confirm the real date each cycle."
            >
              <input
                id="liability-cutoff"
                type="text"
                inputMode="numeric"
                value={statementCutoffDay}
                onChange={(e) => setStatementCutoffDay(e.target.value)}
                className={inputClass}
                placeholder="e.g. 15"
              />
            </Field>
            <Field label="Days Until Due (after close)" htmlFor="liability-due">
              <input
                id="liability-due"
                type="text"
                inputMode="numeric"
                value={dueDateOffsetDays}
                onChange={(e) => setDueDateOffsetDays(e.target.value)}
                className={inputClass}
                placeholder="e.g. 21"
              />
            </Field>
          </div>

          <Field label="As Of Date" htmlFor="liability-date">
            <input id="liability-date" type="date" value={startingDate} onChange={(e) => setStartingDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Dialog>

      {inlineAddAccountTypeModal}
    </>
  );
}
