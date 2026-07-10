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

const toDateInputValue = (date) => date.toISOString().slice(0, 10);

// year/month are optional: when omitted, the modal runs in "quick add"
// mode - a plain, freely-editable date field (any day, any month, any
// year) instead of the month-locked calendar, since there's no pre-picked
// month to constrain it to. Year/month/day get resolved (and created if
// missing) at save time instead of being required up front.
export default function AddTransactionModal({
  year,
  month,
  existingDays = [],
  onClose,
  onSaved,
}) {
  const {
    addYear,
    addMonth,
    addDay,
    addTransaction,
    getYearId,
    getMonthId,
    categories,
    travels
  } = useExpenseContext();

  const quickAdd = year == null || month == null;

  const monthIndex = quickAdd ? null : ALL_MONTHS.indexOf(month);
  const defaultDate = quickAdd ? new Date() : computeDefaultTransactionDate(year, monthIndex, existingDays);

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(!quickAdd && !defaultDate);
  const [quickDateValue, setQuickDateValue] = useState(toDateInputValue(defaultDate || new Date()));
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
    const effectiveDate = quickAdd ? (quickDateValue ? new Date(quickDateValue + "T00:00:00") : null) : selectedDate;

    if (!effectiveDate)
      return alert("Please select a date first.");

    const validRows = rows.filter(
      r => r.category?.trim() && r.amount?.trim()
    );

    if (!validRows.length)
      return alert("Please fill at least one valid transaction.");

    try {
      let yearId, monthId;

      if (quickAdd) {
        // Resolve/create on demand - addYear/addMonth are already
        // idempotent (return the existing id if one matches), so this is
        // safe to call regardless of whether the picked date's year/month
        // already exist.
        const effectiveYear = effectiveDate.getFullYear();
        const effectiveMonthName = ALL_MONTHS[effectiveDate.getMonth()];
        yearId = await addYear(effectiveYear);
        monthId = await addMonth(yearId, effectiveMonthName);
      } else {
        yearId = await getYearId(year);
        monthId = await getMonthId(yearId, month);

        if (!yearId || !monthId) {
          alert("Year or month not found in database.");
          return;
        }
      }

      const dayId = await addDay(yearId, monthId, effectiveDate.getDate());

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

      onSaved?.({
        year: quickAdd ? effectiveDate.getFullYear() : year,
        monthName: quickAdd ? ALL_MONTHS[effectiveDate.getMonth()] : month,
      });
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

  const monthStart = quickAdd ? null : new Date(year, monthIndex, 1);
  const monthEnd = quickAdd ? null : new Date(year, monthIndex + 1, 0);

  const hasDate = quickAdd ? Boolean(quickDateValue) : Boolean(selectedDate);

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
            {quickAdd ? "Add Transaction" : `Add Transactions — ${month} ${year}`}
          </h2>

          {/* DATE PICKER */}
          <div className="mb-6">
            <label className="text-sm text-ink-muted mb-1 block">
              Date
            </label>

            {quickAdd ? (
              <input
                type="date"
                value={quickDateValue}
                onChange={(e) => setQuickDateValue(e.target.value)}
                className="border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
            ) : (
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
            )}
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
                        disabled={!hasDate}
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
                        disabled={!hasDate}
                      />
                    </td>

                    {/* TRAVEL SELECT */}
                    <td className="border border-border px-3 py-2">
                      <TravelSelectCell
                        value={r.travelId}
                        onChange={(val) => handleChange(r.id, "travelId", val)}
                        onRequestAdd={() => requestAddTravel(r.id)}
                        travels={travels}
                        disabled={!hasDate}
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
                        disabled={!hasDate}
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
            disabled={!hasDate}
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
              disabled={!hasDate}
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
