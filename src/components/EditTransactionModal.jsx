import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { parseAmountExpression } from "../utils/amountHelpers";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import TravelSelectCell from "./transaction-row/TravelSelectCell";

const generateRowId = () => Date.now() + Math.floor(Math.random() * 1000);

const blankRow = () => ({
  id: generateRowId(),
  category: "",
  amount: "",
  comments: "",
  travelId: "",
  isNew: true,
});

export default function EditTransactionModal({ year, month, day, dayId, transactions = [], onClose }) {
  const {
    updateTransaction,
    removeTransaction,
    addTransaction,
    removeDay,
    getYearId,
    getMonthId,
    travels,
    categories,
  } = useExpenseContext();

  const [rows, setRows] = useState([]);
  const [deletedRows, setDeletedRows] = useState([]);
  const inputRefs = useRef({});

  // Initialize rows from transactions
  useEffect(() => {
    setRows(
      transactions.length
        ? transactions.map((t) => ({
            id: t.id || generateRowId(),
            category: t.category || "",
            amount: t.amountBreakdown?.join(", ") || t.amount?.toString() || "",
            comments: t.comments || "",
            travelId: t.travelId || "",
            isNew: !t.id,
          }))
        : [blankRow()]
    );
  }, [transactions]);

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel(
    (rowId, newTravelId) => updateRow(rowId, "travelId", newTravelId)
  );

  const addRow = () => {
    const newRow = blankRow();
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => inputRefs.current[`category-${newRow.id}`]?.focus(), 50);
  };

  const removeRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!row.isNew) setDeletedRows((prev) => [...prev, id]);
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    try {
      const yearId = await getYearId(year);
      const monthId = await getMonthId(yearId, month);
      if (!yearId || !monthId) {
        alert("Year or month not found in database.");
        return;
      }

      for (const todel_id of deletedRows) {
        await removeTransaction(todel_id);
      }

      for (const r of rows) {
        if (!r.category.trim() || !r.amount.trim()) continue;

        const { total, breakdown } = parseAmountExpression(r.amount);
        if (isNaN(total)) {
          alert(`Invalid amount in category "${r.category}". Use numbers separated by commas.`);
          return;
        }

        const transactionData = {
          category: r.category.trim(),
          amount: total,
          amountBreakdown: breakdown,
          comments: r.comments.trim(),
          travelId: r.travelId || null,
        };

        if (r.isNew) {
          await addTransaction(yearId, monthId, dayId, transactionData);
        } else {
          await updateTransaction(r.id, transactionData);
        }
      }

      if (rows.length === 0) {
        await removeDay(dayId);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save edited transactions:", err);
      alert("Failed to save edited transactions. See console for details.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[75%] max-w-6xl rounded-xl shadow-lg p-6 relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-ink-muted hover:text-ink">
            <X size={18} />
          </button>

          <h2 className="font-display text-xl text-ink mb-6">
            Edit Transactions — {month} {day}, {year}
          </h2>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
                  <th className="border border-border px-3 py-2 w-[20%] font-medium">Category</th>
                  <th className="border border-border px-3 py-2 w-[20%] font-medium">Amount (comma-separated)</th>
                  <th className="border border-border px-3 py-2 w-[20%] font-medium">Travel</th>
                  <th className="border border-border px-3 py-2 w-[35%] font-medium">Comments</th>
                  <th className="border border-border px-3 py-2 w-[5%] font-medium">Remove</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    {/* CATEGORY */}
                    <td className="border border-border px-3 py-2">
                      <CategoryAutocompleteInput
                        value={r.category}
                        onChange={(val) => updateRow(r.id, "category", val)}
                        categories={categories}
                        inputRef={(el) => (inputRefs.current[`category-${r.id}`] = el)}
                      />
                    </td>

                    {/* AMOUNT */}
                    <td className="border border-border px-3 py-2">
                      <input
                        type="text"
                        value={r.amount}
                        onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                        className="money w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                        placeholder="e.g. 195.5, -130, 25.25"
                        ref={(el) => (inputRefs.current[`amount-${r.id}`] = el)}
                      />
                    </td>

                    {/* TRAVEL SELECT */}
                    <td className="border border-border px-3 py-2">
                      <TravelSelectCell
                        value={r.travelId}
                        onChange={(val) => updateRow(r.id, "travelId", val)}
                        onRequestAdd={() => requestAddTravel(r.id)}
                        travels={travels}
                      />
                    </td>

                    {/* COMMENTS */}
                    <td className="border border-border px-3 py-2">
                      <input
                        type="text"
                        value={r.comments}
                        onChange={(e) => updateRow(r.id, "comments", e.target.value)}
                        className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                        placeholder="Comments"
                        ref={(el) => (inputRefs.current[`comments-${r.id}`] = el)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab" && !e.shiftKey && i === rows.length - 1) {
                            e.preventDefault();
                            addRow();
                          }
                        }}
                      />
                    </td>

                    {/* REMOVE */}
                    <td className="border border-border px-3 py-2 text-center">
                      <button onClick={() => removeRow(r.id)} className="text-alert hover:underline">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="text-sm text-ledger-dark hover:underline mb-3">
            + Add Row
          </button>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors">
              Discard
            </button>
            <button onClick={handleSave} className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>

      {inlineAddTravelModal}
    </>
  );
}
