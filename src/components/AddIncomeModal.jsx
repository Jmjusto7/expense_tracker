import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { toDateInputValue } from "../utils/dateHelpers";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import Dialog, { Field, inputClass } from "./Dialog";

export default function AddIncomeModal({ accountId, onClose }) {
  const { addIncomeEntry, incomeCategories } = useExpenseContext();

  const [date, setDate] = useState(toDateInputValue());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async ({ keepOpen }) => {
    if (!date) return setError("Please pick a date.");

    const n = Number(amount);
    if (amount === "" || isNaN(n) || n <= 0) return setError("Please enter a positive amount.");

    setSaving(true);
    setError("");
    try {
      await addIncomeEntry(accountId, {
        date,
        amount: n,
        category: category.trim(),
        comments: comments.trim(),
      });
      if (!keepOpen) return onClose();
      setNotice(`Saved ${n.toLocaleString()}${category.trim() ? ` (${category.trim()})` : ""}.`);
      setAmount("");
      setComments("");
    } catch (err) {
      console.error("Failed to add income:", err);
      setError("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  return (
    <Dialog
      title="Add Income"
      icon={TrendingUp}
      onClose={onClose}
      onSubmit={() => save({ keepOpen: false })}
      onSubmitAnother={() => save({ keepOpen: true })}
      busy={saving}
      error={error}
    >
      {notice && (
        <p role="status" className="text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2 mb-4">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <Field label="Date" htmlFor="income-date">
          <input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Amount" htmlFor="income-amount">
          <input
            id="income-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`money ${inputClass}`}
            placeholder="e.g. 25000"
            data-autofocus
          />
        </Field>

        <Field label="Category (optional)" htmlFor="income-category">
          <CategoryAutocompleteInput id="income-category" value={category} onChange={setCategory} categories={incomeCategories} />
        </Field>

        <Field label="Comments" htmlFor="income-comments">
          <input id="income-comments" type="text" value={comments} onChange={(e) => setComments(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Dialog>
  );
}
