import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { parseAmountExpression } from "../utils/amountHelpers";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import TravelSelectCell from "./transaction-row/TravelSelectCell";
import ConfirmButton from "./ConfirmButton";

export default function EditSingleTransactionModal({ transaction, onClose }) {
  const { updateTransaction, removeTransaction, categories, travels } = useExpenseContext();

  const [category, setCategory] = useState(transaction.category || "");
  const [amount, setAmount] = useState(
    transaction.amountBreakdown?.join(", ") || transaction.amount?.toString() || ""
  );
  const [comments, setComments] = useState(transaction.comments || "");
  const [travelId, setTravelId] = useState(transaction.travelId || "");
  const [error, setError] = useState("");

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel(
    (_rowId, newTravelId) => setTravelId(newTravelId)
  );

  const handleSave = async () => {
    if (!category.trim()) return setError("Category can't be empty.");

    const { total, breakdown } = parseAmountExpression(amount);
    if (isNaN(total)) return setError("Invalid amount - use numbers separated by commas.");

    try {
      await updateTransaction(transaction.id, {
        category: category.trim(),
        amount: total,
        amountBreakdown: breakdown,
        comments: comments.trim(),
        travelId: travelId || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to update transaction:", err);
      setError("Failed to save. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      await removeTransaction(transaction.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      setError("Failed to delete. Please try again.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>

          <h2 className="font-display text-xl text-ink mb-4">Edit Transaction</h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Category</label>
              <CategoryAutocompleteInput
                value={category}
                onChange={setCategory}
                categories={categories}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Amount (comma-separated)
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="e.g. 195.5, -130, 25.25"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">Travel</label>
              <TravelSelectCell
                value={travelId}
                onChange={setTravelId}
                onRequestAdd={() => requestAddTravel(transaction.id)}
                travels={travels}
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

            <div className="flex justify-between items-center mt-2">
              <ConfirmButton
                onConfirm={handleDelete}
                className="flex items-center gap-1 text-sm text-ink-muted hover:text-alert"
                confirmClassName="flex items-center gap-1 text-sm text-white bg-alert px-2 py-1 rounded-md"
                confirmLabel="Confirm delete?"
                title="Delete this transaction"
              >
                <Trash2 size={14} />
                Delete
              </ConfirmButton>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {inlineAddTravelModal}
    </>
  );
}
