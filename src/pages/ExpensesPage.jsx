import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AddTransactionModal from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import { useExpenseContext } from "../context/ExpenseContext";

export default function ExpensesPage() {
  const { year, month } = useParams();
  const navigate = Link; // optional if using back link
  const {
    years,
    addTransaction,
    updateTransaction,
    removeTransaction,
    clearDB,
  } = useExpenseContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDay, setEditDay] = useState(null);

  const yearInt = parseInt(year, 10);
  const yearObj = years.find((y) => y.year === yearInt);
  const monthObj = yearObj?.months?.find((m) => m.name === month);

  // Group transactions by day, sorted most recent first
  const grouped =
  monthObj?.days
    .slice() // clone to avoid mutating original
    .sort((a, b) => b.day - a.day) // most recent day first
    .map((d) => ({
      day: d.day,
      dayId: d.id,
      transactions: d.transactions || [],
    })) || [];


  // ----------------------
  // Add transactions
  // ----------------------
  const handleAddTransactions = async (dayNumber, transactions) => {
    const dayObj = monthObj?.days?.find((d) => d.day === dayNumber);
    if (!dayObj) return;

    for (const t of transactions) {
      await addTransaction(dayObj.id, t); // dayId now hierarchical
    }
    setShowAddModal(false);
  };

  // ----------------------
  // Edit transactions
  // ----------------------
  const handleEditTransactions = async (updatedTransactions) => {
    if (!editDay) return;
    const dayObj = monthObj?.days?.find((d) => d.day === editDay);
    if (!dayObj) return;

    // Remove existing transactions
    for (const t of dayObj.transactions) {
      await removeTransaction(t.id);
    }

    // Add updated transactions
    for (const t of updatedTransactions) {
      await addTransaction(dayObj.id, t);
    }

    setEditDay(null);
  };

  // ----------------------
  // Delete all
  // ----------------------
  const handleDeleteAll = async () => {
    if (
      confirm(
        "Are you sure you want to delete ALL transactions, days, months, and years?"
      )
    ) {
      await clearDB();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6 gap-2">
        <Link
          to={`/expenses/${year}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-gray-800">
          {month} {year}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition"
          >
            <Plus size={16} />
            Add Transaction
          </button>
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition"
          >
            <Trash2 size={16} />
            Delete All DB
          </button>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="text-gray-500">No transactions yet for this month.</p>
      )}

      {grouped.map(({ day, dayId, transactions }) => {
        const total = transactions.reduce(
          (sum, t) => sum + Number(t.amount || 0),
          0
        );

        return (
          <div
            key={dayId} // use unique DB id
            className="group mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden"
          >
            {/* Hover Edit Button */}
            <button
              onClick={() => setEditDay(day)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg p-1.5 transition shadow-sm"
              title="Edit Day"
            >
              <Pencil size={16} />
            </button>

            <div className="flex justify-between mb-3 items-center pr-10">
              <h2 className="text-md font-semibold">Day {day}</h2>
              <span className="text-indigo-600 font-semibold whitespace-nowrap">
                ₱{total.toLocaleString()}
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 w-2/10">Category</th>
                  <th className="border px-3 py-2 w-5/10">Breakdown</th>
                  <th className="border px-3 py-2 w-[90px] text-right">Total</th>
                  <th className="border px-3 py-2 w-4/10">Comments</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const hasMultiple = t.amountBreakdown?.length > 1;
                  const breakdownDisplay = hasMultiple
                    ? t.amountBreakdown.join(" + ")
                    : t.amountBreakdown?.[0] ?? t.amount;

                  return (
                    <tr key={t.id}>
                      <td className="border px-3 py-2">{t.category}</td>
                      <td className="border px-3 py-2 font-mono text-gray-600 text-sm">
                        {breakdownDisplay}
                      </td>
                      <td className="border border-gray-600 px-3 py-2  font-mono text-right font-semibold text-indigo-600">
                        ₱{Number(t.amount || 0).toLocaleString()}
                      </td>
                      <td className="border px-3 py-2 text-gray-500">{t.comments}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && monthObj && (
        <AddTransactionModal
          year={yearInt}
          month={month}
          existingDays={grouped.map((g) => g.day)}
          onSave={handleAddTransactions}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editDay && monthObj && (
        <EditTransactionModal
          year={yearInt}
          month={month}
          day={editDay}
          dayId={monthObj.days.find((d) => d.day === editDay)?.id}
          transactions={
            monthObj.days.find((d) => d.day === editDay)?.transactions || []
          }
          onClose={() => setEditDay(null)}
          onSave={handleEditTransactions}
        />
      )}
    </div>
  );
}
