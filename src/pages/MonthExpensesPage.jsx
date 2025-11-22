import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { ArrowLeft, Plus } from "lucide-react";

const ALL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function MonthExpensesPage() {
  const { year } = useParams();
  const navigate = useNavigate();
  const { years, addMonth, removeMonth } = useExpenseContext();

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

  const handleRemoveMonth = async (monthId, monthName) => {
    if (confirm(`Delete ${monthName} and all days & transactions inside it?`)) {
      await removeMonth(monthId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/expenses")}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-gray-800 flex-1 text-center">
          {year} — Monthly Expenses
        </h1>

        <div style={{ width: "60px" }} />
      </div>

      {/* Add Month */}
      {availableMonths.length > 0 && yearId && (
        <div className="flex items-center gap-2 mb-6">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>

          <button
            onClick={handleAddMonth}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
          >
            <Plus size={14} />
            Add Month
          </button>
        </div>
      )}

      {/* Month Cards */}
      {!yearObj || !yearObj.months || yearObj.months.length === 0 ? (
        <div className="text-center bg-white p-6 rounded-2xl shadow-lg">
          <p className="text-gray-500 mb-4">No months yet.</p>
          <p className="text-gray-400 text-sm">
            Add your first month using the selector above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {yearObj.months
            .sort((a, b) => ALL_MONTHS.indexOf(a.name) - ALL_MONTHS.indexOf(b.name))
            .map((month) => {
              const total = month.days?.reduce(
                (daySum, day) =>
                  daySum +
                  (day.transactions?.reduce((tSum, t) => tSum + Number(t.amount || 0), 0) || 0),
                0
              ) || 0;

              return (
                <div
                  key={month.id}
                  className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition"
                >
                  {/* Click entire left side to go inside month */}
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() =>
                      navigate(`/expenses/${year}/${month.name}`, {
                        state: { yearId, monthId: month.id },
                      })
                    }
                  >
                    <span className="text-lg font-medium">{month.name}</span>
                  </div>

                  <span
                    className="font-semibold text-indigo-600 cursor-pointer mr-4"
                    onClick={() =>
                      navigate(`/expenses/${year}/${month.name}`, {
                        state: { yearId, monthId: month.id },
                      })
                    }
                  >
                    ₱{total.toLocaleString()}
                  </span>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMonth(month.id, month.name);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
