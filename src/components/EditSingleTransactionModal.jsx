import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { parseAmountExpression } from "../utils/amountHelpers";
import { ALL_MONTHS, toDateInputValue } from "../utils/dateHelpers";
import { rememberPaidFrom } from "../utils/transactionRows";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import TravelSelectCell from "./transaction-row/TravelSelectCell";
import AccountSelectCell from "./transaction-row/AccountSelectCell";
import ConfirmButton from "./ConfirmButton";
import AmountPreview from "./AmountPreview";
import Dialog, { Field, inputClass } from "./Dialog";

export default function EditSingleTransactionModal({ transaction, onClose }) {
  const { editTransaction, removeTransaction, categories, travels, accounts } = useExpenseContext();

  const [date, setDate] = useState(
    toDateInputValue(new Date(transaction.yearNumber, ALL_MONTHS.indexOf(transaction.monthName), transaction.dayNumber))
  );
  const [category, setCategory] = useState(transaction.category || "");
  const [amount, setAmount] = useState(transaction.amountBreakdown?.join(", ") || transaction.amount?.toString() || "");
  const [comments, setComments] = useState(transaction.comments || "");
  const [travelId, setTravelId] = useState(transaction.travelId || "");
  const [accountId, setAccountId] = useState(transaction.accountId ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel((_rowId, newTravelId) => setTravelId(newTravelId));

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    if (!category.trim()) return setError("Category can't be empty.");

    const { total, breakdown, error: amountError } = parseAmountExpression(amount);
    if (amountError) return setError(amountError);

    setSaving(true);
    try {
      await editTransaction(transaction.id, {
        date: new Date(`${date}T00:00:00`),
        category: category.trim(),
        amount: total,
        amountBreakdown: breakdown,
        comments: comments.trim(),
        travelId: travelId || null,
        accountId: accountId || null,
      });
      rememberPaidFrom([{ accountId }]);
      onClose();
    } catch (err) {
      console.error("Failed to update transaction:", err);
      setError(err.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await removeTransaction(transaction.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      setError("Failed to delete. Please try again.");
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        title="Edit Transaction"
        icon={Pencil}
        onClose={onClose}
        onSubmit={handleSave}
        busy={saving}
        error={error}
        footerStart={
          <ConfirmButton
            onConfirm={handleDelete}
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-alert"
            confirmClassName="flex items-center gap-1 text-sm text-white bg-alert px-2 py-1 rounded-md"
            confirmLabel="Confirm delete?"
            title="Delete this transaction"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </ConfirmButton>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Date" htmlFor="edit-tx-date">
            <input id="edit-tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Category" htmlFor="edit-tx-category">
            <CategoryAutocompleteInput id="edit-tx-category" value={category} onChange={setCategory} categories={categories} />
          </Field>

          <Field label="Amount (comma-separated parts)" htmlFor="edit-tx-amount">
            <input
              id="edit-tx-amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`money ${inputClass}`}
              placeholder="e.g. 195.5, -130, 25.25"
            />
            <AmountPreview value={amount} />
          </Field>

          <Field label="Travel" htmlFor="edit-tx-travel">
            <TravelSelectCell
              id="edit-tx-travel"
              value={travelId}
              onChange={setTravelId}
              onRequestAdd={() => requestAddTravel(transaction.id)}
              travels={travels}
            />
          </Field>

          <Field label="Paid From" htmlFor="edit-tx-account">
            <AccountSelectCell id="edit-tx-account" value={accountId} onChange={setAccountId} accounts={accounts} />
          </Field>

          <Field label="Comments" htmlFor="edit-tx-comments">
            <input id="edit-tx-comments" type="text" value={comments} onChange={(e) => setComments(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Dialog>

      {inlineAddTravelModal}
    </>
  );
}
