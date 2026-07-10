import { useState } from "react";
import { X, TrendingUp } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";

export default function AddIncomeModal({ accountId, onClose }) {
  const { addIncomeEntry, incomeCategories } = useExpenseContext();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");

    const n = Number(amount);
    if (amount === "" || isNaN(n) || n <= 0)
      return setError("Please enter a positive amount.");

    try {
      await addIncomeEntry(accountId, {
        date,
        amount: n,
        category: category.trim(),
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to add income:", err);
      setError("Failed to save. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-ledger-dark" />
          <h2 className="font-display text-xl text-ink">Add Income</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              placeholder="e.g. 25000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Category (optional)
            </label>
            <CategoryAutocompleteInput
              value={category}
              onChange={setCategory}
              categories={incomeCategories}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">Comments</label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
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
  );
}
