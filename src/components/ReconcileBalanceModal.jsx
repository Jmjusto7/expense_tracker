import { useState, useMemo } from "react";
import { Scale } from "lucide-react";
import { toDateInputValue } from "../utils/dateHelpers";
import { useExpenseContext } from "../context/ExpenseContext";
import { getBalanceAsOf } from "../utils/balanceHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { formatUnits } from "../utils/chartFormat";
import Dialog, { Field, inputClass } from "./Dialog";

export default function ReconcileBalanceModal({ accountId, onClose }) {
  const { accounts, balanceEntries, addReconciliation } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);
  const isForeign = account?.unit != null;
  const isLiability = Boolean(account?.isLiability);

  // Liabilities are stored negative but read as a positive "amount owed".
  const displayValue = (n) =>
    isLiability ? formatCurrency(Math.abs(n)) : isForeign ? formatUnits(n, account.unit) : formatCurrency(n);

  const [date, setDate] = useState(toDateInputValue());
  const [actualBalance, setActualBalance] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Preview only, never stored: what the logged entries say the balance should be.
  const bookBalance = useMemo(() => {
    if (!date) return null;
    return getBalanceAsOf(balanceEntries, accountId, new Date(date));
  }, [balanceEntries, accountId, date]);

  const actualNum = actualBalance === "" ? null : Number(actualBalance);
  const signedActual = actualNum !== null && !isNaN(actualNum) ? (isLiability ? -actualNum : actualNum) : null;
  const delta = signedActual !== null && bookBalance !== null ? signedActual - bookBalance : null;

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    if (actualBalance === "" || isNaN(Number(actualBalance)))
      return setError(
        isLiability
          ? "Please enter how much you currently owe (negative if you have a credit balance)."
          : isForeign
            ? "Please enter the actual units you hold."
            : "Please enter the actual balance you see."
      );

    setSaving(true);
    try {
      await addReconciliation(accountId, {
        date,
        balance: isLiability ? -Number(actualBalance) : Number(actualBalance),
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to reconcile balance:", err);
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog
      title={isLiability ? "Reconcile Amount Owed" : isForeign ? "Reconcile Units" : "Reconcile Balance"}
      icon={Scale}
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Field label="Date" htmlFor="reconcile-date">
          <input id="reconcile-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <div className="bg-surface-sunken rounded-md px-3 py-2 flex flex-wrap justify-between items-center gap-2">
          <span className="text-sm text-ink-muted">
            {isLiability ? "Book amount owed (logged so far)" : isForeign ? "Book units (logged so far)" : "Book balance (logged so far)"}
          </span>
          <span className="money text-sm font-semibold text-ink">{bookBalance === null ? "—" : displayValue(bookBalance)}</span>
        </div>

        <Field
          label={
            isLiability
              ? "How much do you currently owe?"
              : isForeign
                ? "How many units do you actually hold?"
                : "What does your account actually show?"
          }
          htmlFor="reconcile-actual"
        >
          <input
            id="reconcile-actual"
            type="text"
            inputMode="decimal"
            value={actualBalance}
            onChange={(e) => setActualBalance(e.target.value)}
            className={`money ${inputClass}`}
            placeholder={isLiability ? "e.g. 15000, or -2000 for a credit balance" : isForeign ? "e.g. 1000" : "e.g. 18000"}
            data-autofocus
          />
        </Field>

        {delta !== null && (
          <div
            role="status"
            className={`rounded-md px-3 py-2 text-sm font-medium ${delta < 0 ? "bg-alert-soft text-alert" : delta > 0 ? "bg-ledger-soft text-ledger-dark" : "bg-surface-sunken text-ink-muted"
              }`}
          >
            {delta < 0 &&
              `${isLiability ? "Unexplained additional charge" : isForeign ? "Unaccounted decrease" : "Implied spend"} since last reconciliation: ${displayValue(Math.abs(delta))}`}
            {delta > 0 &&
              `${isLiability ? "Unaccounted payment/credit" : "Unaccounted inflow"} since last reconciliation: ${displayValue(Math.abs(delta))}`}
            {delta === 0 && "Matches the book balance exactly - no gap."}
          </div>
        )}

        <Field label="Comments (optional)" htmlFor="reconcile-comments">
          <input
            id="reconcile-comments"
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className={inputClass}
            placeholder={
              isLiability
                ? "e.g. Interest charge, waived fee, untracked payment"
                : isForeign
                  ? "e.g. Stock split, unrecorded sale"
                  : "e.g. Bank fee, interest, cash withdrawal"
            }
          />
        </Field>
      </div>
    </Dialog>
  );
}
