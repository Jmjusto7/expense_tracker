import { useState, useRef } from "react";
import { X } from "lucide-react";
import DatePicker from "react-date-picker";
import "react-date-picker/dist/DatePicker.css";
import "react-calendar/dist/Calendar.css";
import { useExpenseContext } from "../context/ExpenseContext";
import AddTravelModal from "./AddTravelModal";

const ALL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const getRowId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function AddTransactionModal({
  year,
  month,
  existingDays = [],
  onClose
}) {
  const {
    addDay,
    addTransaction,
    getYearId,
    getMonthId,
    categories,
    travels
  } = useExpenseContext();

  const [selectedDate, setSelectedDate] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);
  const [showAddTravelModal, setShowAddTravelModal] = useState(false);

  const [rows, setRows] = useState([
    {
      id: getRowId(),
      category: "",
      amount: "",
      comments: "",
      travelId: "",
    },
  ]);

  const inputRefs = useRef({});
  const monthIndex = ALL_MONTHS.indexOf(month);

  // -----------------------
  // Row Management
  // -----------------------
  const handleAddRow = () => {
    const newRow = {
      id: getRowId(),
      category: "",
      amount: "",
      comments: "",
      travelId: "",
    };

    setRows(prev => [...prev, newRow]);

    setTimeout(() => {
      inputRefs.current[`category-${newRow.id}`]?.focus();
    }, 50);
  };

  const handleChange = (id, field, value) => {
    setRows(rows.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // -----------------------
  // Category Auto Suggest
  // -----------------------
  const getSuggestion = (input) => {
    if (!input?.trim()) return null;

    return categories.find(
      cat =>
        cat.toLowerCase().startsWith(input.toLowerCase()) &&
        cat.toLowerCase() !== input.toLowerCase()
    );
  };

  // -----------------------
  // Amount Parsing
  // -----------------------
  const parseAmount = (expr) => {
    if (!expr) return { total: NaN, breakdown: [] };

    const cleaned = expr.replace(/\s+/g, "");
    if (!/^[-\d.,]+$/.test(cleaned))
      return { total: NaN, breakdown: [] };

    const breakdown = cleaned
      .split(",")
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));

    return {
      total: breakdown.reduce((a, b) => a + b, 0),
      breakdown,
    };
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
        const { total, breakdown } = parseAmount(r.amount);

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
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
        <div className="bg-white w-[80%] max-w-7xl rounded-xl shadow-lg p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          >
            <X size={18} />
          </button>

          <h2 className="text-2xl font-semibold mb-6 text-indigo-700">
            Add Transactions — {month} {year}
          </h2>

          {/* DATE PICKER */}
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-1 block">
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
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 w-[18%]">Category</th>
                  <th className="border px-3 py-2 w-[28%]">Amount</th>
                  <th className="border px-3 py-2 w-[22%]">Travel</th>
                  <th className="border px-3 py-2 w-[32%]">Comments</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const suggestion = getSuggestion(r.category);
                  const ghostText = suggestion
                    ? suggestion.slice(r.category.length)
                    : "";

                  return (
                    <tr key={r.id}>
                      {/* CATEGORY */}
                      <td className="border px-3 py-2">
                        <div className="relative w-full">
                          <input
                            type="text"
                            value={r.category}
                            onChange={(e) =>
                              handleChange(r.id, "category", e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Tab" && suggestion) {
                                e.preventDefault();
                                handleChange(r.id, "category", suggestion);
                              }
                            }}
                            className="w-full border rounded px-2 py-1 bg-transparent relative"
                            placeholder="Category"
                            disabled={!selectedDate}
                          />

                          {r.category && ghostText && (
                            <div className="absolute inset-0 px-2 py-1 pointer-events-none text-gray-400">
                              <span className="invisible">
                                {r.category}
                              </span>
                              {ghostText}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* AMOUNT */}
                      <td className="border px-3 py-2">
                        <input
                          type="text"
                          value={r.amount}
                          onChange={(e) =>
                            handleChange(r.id, "amount", e.target.value)
                          }
                          className="w-full border rounded px-2 py-1 font-mono"
                          disabled={!selectedDate}
                        />
                      </td>

                      {/* TRAVEL SELECT */}
                      <td className="border px-3 py-2">
                        <select
                          value={r.travelId}
                          onChange={(e) => {
                            const val = e.target.value;

                            if (val === "__add__") {
                              setShowAddTravelModal(true);
                              return;
                            }

                            handleChange(r.id, "travelId", val);
                          }}
                          disabled={!selectedDate}
                          className="w-full border rounded px-2 py-1 bg-white"
                        >
                          <option value="">— No Travel —</option>

                          {travels?.map(travel => (
                            <option key={travel.id} value={travel.id}>
                              {travel.title}
                            </option>
                          ))}

                          <option value="__add__">
                            + Add Travel
                          </option>
                        </select>
                      </td>

                      {/* COMMENTS */}
                      <td className="border px-3 py-2">
                        <input
                          type="text"
                          value={r.comments}
                          onChange={(e) =>
                            handleChange(r.id, "comments", e.target.value)
                          }
                          onKeyDown={(e) => handleCommentKeyDown(e, i)}
                          className="w-full border rounded px-2 py-1"
                          disabled={!selectedDate}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleAddRow}
            className="text-sm text-indigo-600 hover:underline mb-3"
            disabled={!selectedDate}
          >
            + Add Row
          </button>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              disabled={!selectedDate}
            >
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
