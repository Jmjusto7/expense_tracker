import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddTravelModal from "./AddTravelModal";

const generateRowId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function EditTransactionModal({ year, month, day, dayId, transactions = [], onClose }) {
  const {
    updateTransaction,
    removeTransaction,
    addTransaction,
    removeDay,
    getYearId,
    getMonthId,
    travels,
  } = useExpenseContext();

  const [rows, setRows] = useState([]);
  const [deletedRows, setDeletedRows] = useState([]);
  const [showAddTravelModal, setShowAddTravelModal] = useState(false);
  const [activeRowForNewTravel, setActiveRowForNewTravel] = useState(null); // track which row triggered add travel
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
        : [{ id: generateRowId(), category: "", amount: "", comments: "", travelId: "", isNew: true }]
    );
  }, [transactions]);

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const newRow = { id: generateRowId(), category: "", amount: "", comments: "", travelId: "", isNew: true };
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => inputRefs.current[`category-${newRow.id}`]?.focus(), 50);
  };

  const removeRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!row.isNew) setDeletedRows((prev) => [...prev, id]);
    setRows(rows.filter((r) => r.id !== id));
  };

  const parseAmount = (expr) => {
    if (!expr) return { total: NaN, breakdown: [] };
    const cleaned = expr.replace(/\s+/g, "");
    if (!/^[-\d.,]+$/.test(cleaned)) return { total: NaN, breakdown: [] };
    const breakdown = cleaned
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((v) => !isNaN(v));
    return { total: breakdown.reduce((a, b) => a + b, 0), breakdown };
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

        const { total, breakdown } = parseAmount(r.amount);
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
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
        <div className="bg-white w-[75%] max-w-6xl rounded-xl shadow-lg p-6 relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>

          <h2 className="text-2xl font-semibold mb-6 text-indigo-700">
            Edit Transactions — {month} {day}, {year}
          </h2>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 w-[20%]">Category</th>
                  <th className="border px-3 py-2 w-[20%]">Amount (comma-separated)</th>
                  <th className="border px-3 py-2 w-[20%]">Travel</th>
                  <th className="border px-3 py-2 w-[35%]">Comments</th>
                  <th className="border px-3 py-2 w-[5%]">Remove</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    {/* CATEGORY */}
                    <td className="border px-3 py-2">
                      <input
                        type="text"
                        value={r.category}
                        onChange={(e) => updateRow(r.id, "category", e.target.value)}
                        className="w-full border rounded px-2 py-1"
                        placeholder="Category"
                        ref={(el) => (inputRefs.current[`category-${r.id}`] = el)}
                      />
                    </td>

                    {/* AMOUNT */}
                    <td className="border px-3 py-2">
                      <input
                        type="text"
                        value={r.amount}
                        onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                        className="w-full border rounded px-2 py-1 font-mono"
                        placeholder="e.g. 195.5, -130, 25.25"
                        ref={(el) => (inputRefs.current[`amount-${r.id}`] = el)}
                      />
                    </td>

                    {/* TRAVEL SELECT */}
                    <td className="border px-3 py-2">
                      <select
                        value={r.travelId}
                        onChange={(e) => {
                          if (e.target.value === "__add__") {
                            setActiveRowForNewTravel(r.id);
                            setShowAddTravelModal(true);
                            return;
                          }
                          updateRow(r.id, "travelId", e.target.value);
                        }}
                        className="w-full border rounded px-2 py-1 bg-white"
                      >
                        <option value="">— No Travel —</option>
                        {travels?.map((travel) => (
                          <option key={travel.id} value={travel.id}>
                            {travel.title}
                          </option>
                        ))}
                        <option value="__add__">+ Add Travel</option>
                      </select>
                    </td>

                    {/* COMMENTS */}
                    <td className="border px-3 py-2">
                      <input
                        type="text"
                        value={r.comments}
                        onChange={(e) => updateRow(r.id, "comments", e.target.value)}
                        className="w-full border rounded px-2 py-1"
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
                    <td className="border px-3 py-2 text-center">
                      <button onClick={() => removeRow(r.id)} className="text-red-600 hover:underline">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="text-sm text-indigo-600 hover:underline mb-3">
            + Add Row
          </button>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
              Discard
            </button>
            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              Save
            </button>
          </div>
        </div>
      </div>

      {/* ADD TRAVEL MODAL */}
      {showAddTravelModal && (
        <AddTravelModal
          onClose={() => setShowAddTravelModal(false)}
        />
      )}
    </>
  );
}
