import { useState, useRef } from "react";
import { X } from "lucide-react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { useExpenseContext } from "../context/ExpenseContext";
import { ALL_MONTHS, computeDefaultTransactionDate } from "../utils/dateHelpers";
import { parseAmountExpression } from "../utils/amountHelpers";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import TravelSelectCell from "./transaction-row/TravelSelectCell";

const getRowId = () => Date.now() + Math.floor(Math.random() * 1000);

const blankRow = () => ({
  id: getRowId(),
  category: "",
  amount: "",
  comments: "",
  travelId: "",
});

export default function AddTransactionModal({
  year,
  month,
  existingDays = [],
  onClose,
  onSaved,
}) {
  const {
    addDay,
    addTransaction,
    getYearId,
    getMonthId,
    categories,
    travels
  } = useExpenseContext();

  const monthIndex = ALL_MONTHS.indexOf(month);
  const defaultDate = computeDefaultTransactionDate(year, monthIndex, existingDays);

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(!defaultDate);
  const [rows, setRows] = useState([blankRow()]);

  const inputRefs = useRef({});

  const handleChange = (id, field, value) => {
    setRows(rows.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel(
    (rowId, newTravelId) => handleChange(rowId, "travelId", newTravelId)
  );

  // -----------------------
  // Row Management
  // -----------------------
  const handleAddRow = () => {
    const newRow = blankRow();
    setRows(prev => [...prev, newRow]);

    setTimeout(() => {
      inputRefs.current[`category-${newRow.id}`]?.focus();
    }, 50);
  };

  // -----------------------
  // Save
  // -----------------------
  const handleSave = async () => {
    if (!selectedDate)
      return alert("Please select a date first.");

    const dayNumber = selectedDate.getDate();

    const validRows = rows.filter(
      r => r.category?.trim() && r.amount?.trim()
    );

    if (!validRows.length)
      return alert("Please fill at least one valid transaction.");

    try {
      const yearId = await getYearId(year);
      const monthId = await getMonthId(yearId, month);

      if (!yearId || !monthId) {
        alert("Year or month not found in database.");
        return;
      }

      const dayId = await addDay(yearId, monthId, dayNumber);

      for (const r of validRows) {
        const { total, breakdown } = parseAmountExpression(r.amount);

        if (isNaN(total))
          return alert(`Invalid amount in category "${r.category}"`);

        await addTransaction(yearId, monthId, dayId, {
          category: r.category.trim(),
          amount: total,
          amountBreakdown: breakdown,
          comments: r.comments?.trim() || "",
          travelId: r.travelId || null,
        });
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save transactions:", err);
      alert("Failed to save transactions.");
    }
  };

  const handleCommentKeyDown = (e, rowIndex) => {
    if (e.key === "Tab" && rowIndex === rows.length - 1 && !e.shiftKey) {
      e.preventDefault();
      handleAddRow();
    }
  };

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[80%] max-w-7xl rounded-xl shadow-lg p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>

          <h2 className="font-display text-xl text-ink mb-6">
            Add Transactions — {month} {year}
          </h2>

          {/* DATE PICKER */}
          <div className="mb-6">
            <label className="text-sm text-ink-muted mb-1 block">
              Select a Date
            </label>

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

          {/* TABLE */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
                  <th className="border border-border px-3 py-2 w-[18%] font-medium">Category</th>
                  <th className="border border-border px-3 py-2 w-[28%] font-medium">Amount</th>
                  <th className="border border-border px-3 py-2 w-[22%] font-medium">Travel</th>
                  <th className="border border-border px-3 py-2 w-[32%] font-medium">Comments</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    {/* CATEGORY */}
                    <td className="border border-border px-3 py-2">
                      <CategoryAutocompleteInput
                        value={r.category}
                        onChange={(val) => handleChange(r.id, "category", val)}
                        categories={categories}
                        disabled={!selectedDate}
                        inputRef={(el) => (inputRefs.current[`category-${r.id}`] = el)}
                      />
                    </td>

                    {/* AMOUNT */}
                    <td className="border border-border px-3 py-2">
                      <input
                        type="text"
                        value={r.amount}
                        onChange={(e) =>
                          handleChange(r.id, "amount", e.target.value)
                        }
                        className="money w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50"
                        disabled={!selectedDate}
                      />
                    </td>

                    {/* TRAVEL SELECT */}
                    <td className="border border-border px-3 py-2">
                      <TravelSelectCell
                        value={r.travelId}
                        onChange={(val) => handleChange(r.id, "travelId", val)}
                        onRequestAdd={() => requestAddTravel(r.id)}
                        travels={travels}
                        disabled={!selectedDate}
                      />
                    </td>

                    {/* COMMENTS */}
                    <td className="border border-border px-3 py-2">
                      <input
                        type="text"
                        value={r.comments}
                        onChange={(e) =>
                          handleChange(r.id, "comments", e.target.value)
                        }
                        onKeyDown={(e) => handleCommentKeyDown(e, i)}
                        className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50"
                        disabled={!selectedDate}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleAddRow}
            className="text-sm text-ledger-dark hover:underline mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedDate}
          >
            + Add Row
          </button>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedDate}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {inlineAddTravelModal}
    </>
  );
}
