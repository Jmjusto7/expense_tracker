import { useState, useRef, useMemo } from "react";
import { Plus } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { ALL_MONTHS, formatDate, toDateInputValue } from "../utils/dateHelpers";
import { findTravelForDate } from "../utils/travelHelpers";
import { blankRow, buildRowUpserts, getLastPaidFrom, rememberPaidFrom } from "../utils/transactionRows";
import { useInlineAddTravel } from "../hooks/useInlineAddTravel";
import TransactionRowsEditor from "./transaction-row/TransactionRowsEditor";
import Dialog, { Field, inputClass } from "./Dialog";

const parseLocalDate = (value) => (value ? new Date(`${value}T00:00:00`) : null);

// Without year/month this is "quick add" (any date). With them, the date is
// limited to that month and defaults to today when it's the current month.
// Picking a day that already has transactions is fine - rows merge by category.
export default function AddTransactionModal({ year, month, onClose, onSaved, defaultTravelId = null, defaultDate = null }) {
  const { saveDayTransactions, categories, travels, accounts, years } = useExpenseContext();

  const monthContext = year != null && month != null;
  const monthIndex = monthContext ? ALL_MONTHS.indexOf(month) : null;

  const initialDate = useMemo(() => {
    if (defaultDate) return toDateInputValue(new Date(defaultDate));
    const today = new Date();
    if (!monthContext || (today.getFullYear() === year && today.getMonth() === monthIndex)) return toDateInputValue(today);
    return "";
  }, [defaultDate, monthContext, year, monthIndex]);

  const makeRow = (forDate) => {
    if (defaultTravelId) return blankRow({ travelId: defaultTravelId, accountId: getLastPaidFrom(accounts) });
    const match = findTravelForDate(travels, parseLocalDate(forDate));
    return blankRow({ travelId: match?.id ?? "", travelAuto: Boolean(match), accountId: getLastPaidFrom(accounts) });
  };

  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState(() => [makeRow(initialDate)]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef({});

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const { requestAddTravel, inlineAddTravelModal } = useInlineAddTravel((rowId, newTravelId) =>
    updateRow(rowId, { travelId: newTravelId, travelAuto: false })
  );

  const handleDateChange = (value) => {
    setDate(value);
    const match = findTravelForDate(travels, parseLocalDate(value));
    // Re-match the trip only on rows the user hasn't tagged by hand.
    setRows((prev) =>
      prev.map((r) => (r.travelAuto || !r.travelId ? { ...r, travelId: match?.id ?? "", travelAuto: Boolean(match) } : r))
    );
  };

  const addRow = () => {
    const row = makeRow(date);
    setRows((prev) => [...prev, row]);
    setTimeout(() => inputRefs.current[`category-${row.id}`]?.focus(), 50);
  };

  const removeRow = (id) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const existingCount = useMemo(() => {
    const d = parseLocalDate(date);
    if (!d) return 0;
    const dayObj = years
      .find((y) => y.year === d.getFullYear())
      ?.months?.find((m) => m.name === ALL_MONTHS[d.getMonth()])
      ?.days?.find((x) => x.day === d.getDate());
    return dayObj?.transactions?.length ?? 0;
  }, [years, date]);

  const save = async ({ keepOpen }) => {
    const effectiveDate = parseLocalDate(date);
    if (!effectiveDate) return setError("Please pick a date first.");

    const { upserts, error: rowError } = buildRowUpserts(rows, { dateLabel: formatDate(effectiveDate), travels, accounts });
    if (rowError) return setError(rowError);
    if (!upserts.length) return setError("Fill in a category and amount for at least one item.");

    setSaving(true);
    setError("");
    try {
      await saveDayTransactions({ date: effectiveDate, upserts });
      rememberPaidFrom(upserts);
      if (!keepOpen) {
        onSaved?.({ year: effectiveDate.getFullYear(), monthName: ALL_MONTHS[effectiveDate.getMonth()] });
        return onClose();
      }
      setNotice(`Saved ${upserts.length} item${upserts.length === 1 ? "" : "s"} to ${formatDate(effectiveDate)}.`);
      const fresh = makeRow(date);
      setRows([fresh]);
      setTimeout(() => inputRefs.current[`category-${fresh.id}`]?.focus(), 50);
    } catch (err) {
      console.error("Failed to save transactions:", err);
      setError(err.message || "Failed to save transactions.");
    }
    setSaving(false);
  };

  const monthStart = monthContext ? toDateInputValue(new Date(year, monthIndex, 1)) : undefined;
  const monthEnd = monthContext ? toDateInputValue(new Date(year, monthIndex + 1, 0)) : undefined;

  return (
    <>
      <Dialog
        title={monthContext ? `Add Transactions — ${month} ${year}` : "Add Transaction"}
        icon={Plus}
        size="xl"
        onClose={onClose}
        onSubmit={() => save({ keepOpen: false })}
        onSubmitAnother={() => save({ keepOpen: true })}
        busy={saving}
        submitDisabled={!date}
        error={error}
      >
        {notice && (
          <p role="status" className="text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2 mb-4">
            {notice}
          </p>
        )}

        <div className="mb-5 max-w-xs">
          <Field
            label="Date"
            htmlFor="add-tx-date"
            hint={
              !date
                ? "Pick a date to start."
                : existingCount > 0
                  ? `This day already has ${existingCount} item${existingCount === 1 ? "" : "s"}; matching categories are combined.`
                  : undefined
            }
          >
            <input
              id="add-tx-date"
              type="date"
              value={date}
              min={monthStart}
              max={monthEnd}
              onChange={(e) => handleDateChange(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <TransactionRowsEditor
          rows={rows}
          onChange={updateRow}
          onRemove={rows.length > 1 ? removeRow : undefined}
          onAddRow={addRow}
          onRequestAddTravel={requestAddTravel}
          categories={categories}
          travels={travels}
          accounts={accounts}
          disabled={!date || saving}
          inputRefs={inputRefs}
        />
      </Dialog>

      {inlineAddTravelModal}
    </>
  );
}
