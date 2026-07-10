import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Plus } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
import { formatCurrency } from "../utils/formatCurrency";
import ExpenseAnalytics from "../components/ExpenseAnalytics";
import ConfirmButton from "../components/ConfirmButton";

export default function YearExpensesPage() {
  const navigate = useNavigate();
  const { years, addYear, removeYear } = useExpenseContext();
  const { matches, hasActiveFilters } = useFilter();

  const [addingYear, setAddingYear] = useState(false);
  const [yearInput, setYearInput] = useState("");
  const [yearError, setYearError] = useState("");

  // Ensure years is always an array
  const sortedYears = Array.isArray(years)
    ? [...years].sort((a, b) => b.year - a.year)
    : [];

  // Total for a year, respecting the active filter (a no-op filter still
  // matches everything, so this works identically whether or not a filter
  // is active).
  const getYearTotal = (yearObj) =>
    yearObj.months
      ?.flatMap((m) => m.days || [])
      .flatMap((d) => d.transactions || [])
      .filter(matches)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  // Counts used to make a delete confirmation concrete rather than generic.
  const getYearCounts = (yearObj) => {
    const months = yearObj.months?.length || 0;
    const transactions =
      yearObj.months?.flatMap((m) => m.days || []).flatMap((d) => d.transactions || []).length || 0;
    return { months, transactions };
  };

  const openAddYear = () => {
    setYearInput(String(new Date().getFullYear()));
    setYearError("");
    setAddingYear(true);
  };

  const handleAddYear = () => {
    const parsed = parseInt(yearInput, 10);
    if (isNaN(parsed) || parsed < 1900 || parsed > 3000) {
      setYearError("Enter a valid year between 1900 and 3000.");
      return;
    }
    if (sortedYears.some((y) => y.year === parsed)) {
      setYearError(`${parsed} already exists.`);
      return;
    }
    addYear(parsed);
    setAddingYear(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-ink mb-6">Expenses</h1>

      {/* Bucket/category drill-down, stat cards, and monthly trend now live
          here - this is where filters get *set*; MonthExpensesPage and
          ExpensesPage further down the hierarchy can still only remove
          them via FilterBar. */}
      <ExpenseAnalytics />

      <h2 className="text-lg font-semibold text-ink mb-3">By Year</h2>

      <div className="space-y-3">
        {sortedYears.length === 0 && !addingYear && (
          <p className="text-ink-muted text-center py-8">
            No years added yet. Add a year below to get started.
          </p>
        )}

        {sortedYears.map((yearObj) => {
          const total = getYearTotal(yearObj);
          const noMatches = hasActiveFilters && total === 0;
          const { months, transactions } = getYearCounts(yearObj);

          return (
            <div
              key={yearObj.id}
              className={`group flex justify-between items-center bg-surface border border-border p-4 rounded-lg hover:border-ledger cursor-pointer transition-colors ${
                noMatches ? "opacity-50" : ""
              }`}
              onClick={() => navigate(`/expenses/${yearObj.year}`)}
            >
              <span className="text-lg font-medium text-ink">{yearObj.year}</span>
              <div className="flex items-center gap-3">
                <span className="money font-semibold text-ledger-dark">
                  {formatCurrency(total)}
                </span>
                <ConfirmButton
                  onConfirm={() => removeYear(yearObj.id)}
                  className="opacity-70 group-hover:opacity-100 text-ink-muted hover:text-alert transition-opacity p-1"
                  confirmClassName="text-alert text-xs font-medium px-2 py-1 rounded-md bg-alert-soft"
                  title={`Delete ${yearObj.year}? Removes ${months} month${months === 1 ? "" : "s"} and ${transactions} transaction${transactions === 1 ? "" : "s"}.`}
                  confirmLabel="Sure?"
                >
                  <Trash2 size={16} />
                </ConfirmButton>
              </div>
            </div>
          );
        })}

        {addingYear ? (
          <div className="bg-surface border border-border p-4 rounded-lg flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={yearInput}
                onChange={(e) => {
                  setYearInput(e.target.value);
                  setYearError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddYear()}
                autoFocus
                className="border border-border rounded-md px-3 py-2 text-ink bg-surface w-32 focus:ring-2 focus:ring-ledger focus:outline-none"
              />
              <button
                onClick={handleAddYear}
                className="bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setAddingYear(false)}
                className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
            {yearError && <p className="text-alert text-sm">{yearError}</p>}
          </div>
        ) : (
          <button
            onClick={openAddYear}
            className="w-full mt-2 flex items-center justify-center gap-1.5 bg-ledger hover:bg-ledger-dark text-white font-medium py-3 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Year
          </button>
        )}
      </div>
    </div>
  );
}
