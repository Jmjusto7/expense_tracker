import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { ALL_MONTHS } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import FilterBar from "../components/FilterBar";
import ConfirmButton from "../components/ConfirmButton";

export default function MonthExpensesPage() {
  const { year } = useParams();
  const navigate = useNavigate();
  const { years, addMonth, removeMonth } = useExpenseContext();
  const { matches, hasActiveFilters } = useFilter();

  const yearInt = parseInt(year, 10);
  const yearObj = years.find((y) => y.year === yearInt);
  const yearId = yearObj?.id;

  // Existing months for this year
  const existingMonths = yearObj?.months?.map((m) => m.name) || [];
  const availableMonths = ALL_MONTHS.filter((m) => !existingMonths.includes(m));

  // Compute default next month to auto-select
  const computeNextMonth = () => {
    if (availableMonths.length === 0) return "";

    if (existingMonths.length === 0) {
      const currentMonth = ALL_MONTHS[new Date().getMonth()];
      return availableMonths.includes(currentMonth) ? currentMonth : availableMonths[0];
    }

    const lastIndex = Math.max(...existingMonths.map((m) => ALL_MONTHS.indexOf(m)));
    const nextIndex = lastIndex + 1;
    return nextIndex < ALL_MONTHS.length ? ALL_MONTHS[nextIndex] : availableMonths[0];
  };

  const [selectedMonth, setSelectedMonth] = useState(computeNextMonth());

  useEffect(() => {
    setSelectedMonth(computeNextMonth());
  }, [existingMonths.join(","), availableMonths.join(",")]);

  const handleAddMonth = async () => {
    if (!selectedMonth || !yearId) return;
    await addMonth(yearId, selectedMonth);
  };

  const handleRemoveMonth = async (monthId) => {
    await removeMonth(monthId);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-2 transition-colors"
        >
          <ArrowLeft size={14} />
          All years
        </Link>
        <h1 className="font-display text-2xl text-ink">{year} — Monthly Expenses</h1>
      </div>

      <FilterBar />

      {/* Add Month */}
      {availableMonths.length > 0 && yearId && (
        <div className="flex items-center gap-2 mb-6">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>

          <button
            onClick={handleAddMonth}
            className="flex items-center gap-1 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus size={14} />
            Add Month
          </button>
        </div>
      )}

      {/* Month Cards */}
      {!yearObj || !yearObj.months || yearObj.months.length === 0 ? (
        <div className="text-center bg-surface border border-border p-6 rounded-lg">
          <p className="text-ink-muted mb-1">No months yet.</p>
          <p className="text-ink-muted text-sm">
            Add your first month using the selector above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {yearObj.months
            .sort((a, b) => ALL_MONTHS.indexOf(a.name) - ALL_MONTHS.indexOf(b.name))
            .map((month) => {
              const total = month.days?.reduce(
                (daySum, day) =>
                  daySum +
                  (day.transactions?.filter(matches).reduce((tSum, t) => tSum + Number(t.amount || 0), 0) || 0),
                0
              ) || 0;

              const noMatches = hasActiveFilters && total === 0;
              const dayCount = month.days?.length || 0;
              const txCount = month.days?.flatMap((d) => d.transactions || []).length || 0;

              return (
                <div
                  key={month.id}
                  className={`group flex justify-between items-center bg-surface border border-border p-4 rounded-lg hover:border-ledger cursor-pointer transition-colors ${
                    noMatches ? "opacity-50" : ""
                  }`}
                  onClick={() =>
                    navigate(`/expenses/${year}/${month.name}`, {
                      state: { yearId, monthId: month.id },
                    })
                  }
                >
                  <span className="text-lg font-medium text-ink">{month.name}</span>

                  <div className="flex items-center gap-3">
                    <span className="money font-semibold text-ledger-dark">
                      {formatCurrency(total)}
                    </span>

                    <ConfirmButton
                      onConfirm={() => handleRemoveMonth(month.id)}
                      className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-alert transition-opacity p-1"
                      confirmClassName="text-alert text-xs font-medium px-2 py-1 rounded-md bg-alert-soft"
                      title={`Delete ${month.name}? Removes ${dayCount} day${dayCount === 1 ? "" : "s"} and ${txCount} transaction${txCount === 1 ? "" : "s"}.`}
                      confirmLabel="Sure?"
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
