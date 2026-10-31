import { useState, useRef } from "react";
import { Pencil } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import { blankRow, buildRowUpserts, getLastPaidFrom, rememberPaidFrom } from "../utils/transactionRows";
import TransactionRowsEditor from "./transaction-row/TransactionRowsEditor";
import ConfirmButton from "./ConfirmButton";
import Dialog from "./Dialog";

const toRow = (t) => ({
  id: t.id,
  category: t.category || "",
  amount: t.amountBreakdown?.join(", ") || t.amount?.toString() || "",
  comments: t.comments || "",
  travelId: t.travelId || "",
  travelAuto: false,
  accountId: t.accountId ?? null,
  isNew: false,
});

export default function EditTransactionModal({ year, month, day, dayId, transactions = [], onClose }) {
  const { saveDayTransactions, getYearId, getMonthId, travels, categories, accounts } = useExpenseContext();

  const [rows, setRows] = useState(() =>
    transactions.length ? transactions.map(toRow) : [blankRow({ accountId: getLastPaidFrom(accounts) })]
  );
  const [deletedRows, setDeletedRows] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef({});

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel((rowId, newTravelId) =>
    updateRow(rowId, { travelId: newTravelId, travelAuto: false })
  );

  const addRow = () => {
    const row = blankRow({ accountId: getLastPaidFrom(accounts) });
    setRows((prev) => [...prev, row]);
    setTimeout(() => inputRefs.current[`category-${row.id}`]?.focus(), 50);
  };

  const removeRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!row.isNew) setDeletedRows((prev) => [...prev, id]);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const dateLabel = `${month} ${day}, ${year}`;

  const save = async (deletes, upserts) => {
    setSaving(true);
    setError("");
    try {
      const yearId = await getYearId(year);
      const monthId = await getMonthId(yearId, month);
      if (!yearId || !monthId) throw new Error("Year or month not found.");
      await saveDayTransactions({ yearId, monthId, dayId, deletes, upserts });
      rememberPaidFrom(upserts);
      onClose();
    } catch (err) {
      console.error("Failed to save edited transactions:", err);
      setError(err.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const handleSave = () => {
    const { upserts, error: rowError } = buildRowUpserts(rows, { dateLabel, travels, accounts });
    if (rowError) return setError(rowError);
    return save(deletedRows, upserts);
  };

  const handleDeleteDay = () =>
    save(
      transactions.map((t) => t.id),
      []
    );

  return (
    <>
      <Dialog
        title={`Edit ${dateLabel}`}
        icon={Pencil}
        size="xl"
        onClose={onClose}
        onSubmit={handleSave}
        busy={saving}
        error={error}
        cancelLabel="Discard"
        footerStart={
          transactions.length > 0 && (
            <ConfirmButton
              onConfirm={handleDeleteDay}
              className="text-sm text-ink-muted hover:text-alert"
              confirmClassName="text-sm text-white bg-alert px-2 py-1 rounded-md"
              confirmLabel={`Delete all ${transactions.length}?`}
              title="Delete every transaction on this day"
            >
              Delete day
            </ConfirmButton>
          )
        }
      >
        <TransactionRowsEditor
          rows={rows}
          onChange={updateRow}
          onRemove={removeRow}
          onAddRow={addRow}
          onRequestAddTravel={requestAddTravel}
          categories={categories}
          travels={travels}
          accounts={accounts}
          disabled={saving}
          inputRefs={inputRefs}
        />
      </Dialog>

      {inlineAddTravelModal}
    </>
  );
}
