import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { getNextStatementClose } from "../utils/balanceHelpers";
import { toDateInputValue } from "../utils/dateHelpers";
import Dialog, { Field, inputClass } from "./Dialog";

// Logs the actual date a liability's statement closed - a real dated fact
// the user confirms each cycle. The date prefills with the next unlogged
// cutoff as a convenience, but is always editable.
export default function LogStatementCloseModal({ accountId, onClose }) {
  const { accounts, balanceEntries, addStatementClose } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const suggested = getNextStatementClose(balanceEntries, account)?.date ?? new Date();

  const [date, setDate] = useState(toDateInputValue(suggested));
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date) return setError("Please pick the date this statement actually closed.");

    setSaving(true);
    try {
      await addStatementClose(accountId, { date, comments });
      onClose();
    } catch (err) {
      console.error("Failed to log statement close:", err);
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog title="Log Statement Close" icon={CalendarCheck} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
      <p className="text-sm text-ink-muted mb-4">
        Confirm the actual date this statement closed - prefilled with the next cutoff you haven&apos;t logged yet, but
        adjust it if the real date shifted (weekends, holidays, short months, etc).
      </p>

      <div className="flex flex-col gap-4">
        <Field label="Cutoff Date" htmlFor="statement-close-date">
          <input id="statement-close-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Comments (optional)" htmlFor="statement-close-comments">
          <input
            id="statement-close-comments"
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </Dialog>
  );
}
