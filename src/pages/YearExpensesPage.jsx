import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";

export default function YearExpensesPage() {
  const navigate = useNavigate();
  const { years, addYear, removeYear } = useExpenseContext();

  // Ensure years is always an array
  const sortedYears = Array.isArray(years)
    ? [...years].sort((a, b) => b.year - a.year)
    : [];

  // Compute total for a year
  const getYearTotal = (yearObj) =>
  yearObj.months
    ?.flatMap((m) => m.days || [])
    .flatMap((d) => d.transactions || [])
    .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  // Add new year manually
  const handleAddYear = () => {
    const input = prompt("Enter a year to add (e.g., 2026):");
    if (!input) return;

    const parsed = parseInt(input, 10);
    if (isNaN(parsed) || parsed < 1900 || parsed > 3000) {
      alert("Please enter a valid year between 1900 and 3000.");
      return;
    }

    if (sortedYears.some((y) => y.year === parsed)) {
      alert(`Year ${parsed} already exists.`);
      return;
    }

    addYear(parsed);
  };

  // Delete a year
  const handleRemoveYear = (yearId) => {
    if (confirm("Delete this year and all its data?")) {
      removeYear(yearId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-gray-800 flex-1 text-center">
          Expenses by Year
        </h1>

        <div style={{ width: "60px" }} /> {/* spacer */}
      </div>

      <div className="space-y-4">
        {sortedYears.length === 0 && (
          <p className="text-gray-500 text-center">No years added yet. Add a year below.</p>
        )}

        {sortedYears.map((yearObj) => (
          <div
            key={yearObj.id} // unique DB id
            className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition"
            onClick={() => navigate(`/expenses/${yearObj.year}`)}
          >
            <span className="text-lg font-medium">{yearObj.year}</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-600">
                ₱{getYearTotal(yearObj).toLocaleString()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent navigation click
                  handleRemoveYear(yearObj.id);
                }}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleAddYear}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition"
        >
          + Add Year
        </button>
      </div>
    </div>
  );
}
