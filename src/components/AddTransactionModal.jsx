import { useState, useRef } from "react";
import { X } from "lucide-react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { useExpenseContext } from "../context/ExpenseContext";

const ALL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const getRowId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function AddTransactionModal({ year, month, existingDays = [], onClose }) {
  const {addDay, addTransaction, getYearId, getMonthId } = useExpenseContext();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);
  const [rows, setRows] = useState([{ id: getRowId(), category: "", amount: "", comments: "" }]);
  const inputRefs = useRef({});
  const monthIndex = ALL_MONTHS.indexOf(month);

  const handleAddRow = () => {
    const newRow = { id: getRowId(), category: "", amount: "", comments: "" };
    setRows(prev => [...prev, newRow]);
    setTimeout(() => inputRefs.current[`category-${newRow.id}`]?.focus(), 50);
  };

  const handleChange = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const parseAmount = (expr) => {
    if (!expr) return { total: NaN, breakdown: [] };
    const cleaned = expr.replace(/\s+/g, "");
    if (!/^[-\d.,]+$/.test(cleaned)) return { total: NaN, breakdown: [] };
    const breakdown = cleaned.split(",").map(v => parseFloat(v)).filter(v => !isNaN(v));
    return { total: breakdown.reduce((a, b) => a + b, 0), breakdown };
  };

  const handleSave = async () => {
    if (!selectedDate) return alert("Please select a date first.");

    const dayNumber = selectedDate.getDate();
    const validRows = rows.filter(r => r.category?.trim() && r.amount?.trim());

    if (!validRows.length) return alert("Please fill at least one valid transaction.");

    try {
      // --- Retrieve existing year & month IDs ---
      const yearId = await getYearId(year);
      const monthId = await getMonthId(yearId, month);

      if (!yearId || !monthId) {
        alert("Year or month not found in database.");
        return alert("Please create date/month first.");
      }

      // --- Get or create day ID ---
      let dayId;
      dayId = await addDay(yearId, monthId, dayNumber);
    
      // --- Add transactions ---
      for (const r of validRows) {
        const { total, breakdown } = parseAmount(r.amount);
        if (isNaN(total)) return alert(`Invalid amount in category "${r.category}"`);

        await addTransaction(yearId, monthId, dayId, {
          category: r.category.trim(),
          amount: total,
          amountBreakdown: breakdown,
          comments: r.comments?.trim() || "",
        });
      }

      onClose();
    } catch (err) {
      console.error("Failed to save transactions:", err);
      alert("Failed to save transactions. See console for details.");
    }
  };

  const handleCommentKeyDown = (e, rowIndex) => {
    if (e.key === "Tab" && rowIndex === rows.length - 1 && !e.shiftKey) {
      e.preventDefault(); // prevent normal tab behavior
      handleAddRow();
    }
  };

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white w-[75%] max-w-6xl rounded-xl shadow-lg p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">
          <X size={18} />
        </button>

        <h2 className="text-2xl font-semibold mb-6 text-indigo-700">
          Add Transactions — {month} {year}
        </h2>

        <div className="mb-6">
          <label className="text-sm text-gray-600 mb-1 block">Select a Date</label>
          <DatePicker
            onChange={(date) => {
              setSelectedDate(date);
              setIsCalendarOpen(false);
            }}
            value={selectedDate}
            minDate={monthStart}
            maxDate={monthEnd}
            calendarIcon={null}
            clearIcon={null}
            format="y-MM-dd"
            isOpen={isCalendarOpen}
            calendarProps={{
              activeStartDate: selectedDate || monthStart,
              tileDisabled: ({ date, view }) => {
                if (view !== "month") return false;
                return date.getFullYear() === year &&
                       date.getMonth() === monthIndex &&
                       existingDays.includes(date.getDate());
              },
            }}
          />
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 w-[20%]">Category</th>
                <th className="border px-3 py-2 w-[55%]">Amount</th>
                <th className="border px-3 py-2 w-[25%]">Comments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="border px-3 py-2">
                    <input
                      type="text"
                      value={r.category || ""}
                      onChange={e => handleChange(r.id, "category", e.target.value)}
                      className="w-full border rounded px-2 py-1"
                      placeholder="Category"
                      disabled={!selectedDate}
                      ref={el => inputRefs.current[`category-${r.id}`] = el}
                    />
                  </td>
                  <td className="border px-3 py-2">
                    <input
                      type="text"
                      value={r.amount || ""}
                      onChange={e => handleChange(r.id, "amount", e.target.value)}
                      className="w-full border rounded px-2 py-1 font-mono"
                      placeholder="e.g. 195.5, -130, 25.25"
                      disabled={!selectedDate}
                      ref={el => inputRefs.current[`amount-${r.id}`] = el}
                    />
                  </td>
                  <td className="border px-3 py-2">
                    <input
                      type="text"
                      value={r.comments}
                      onChange={e => handleChange(r.id, "comments", e.target.value)}
                      onKeyDown={e => handleCommentKeyDown(e, i)}
                      className="w-full border rounded px-2 py-1"
                      placeholder="Comments"
                      disabled={!selectedDate}
                      ref={el => inputRefs.current[`comments-${r.id}`] = el}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={handleAddRow} className="text-sm text-indigo-600 hover:underline mb-3" disabled={!selectedDate}>
          + Add Row
        </button>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700" disabled={!selectedDate}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
