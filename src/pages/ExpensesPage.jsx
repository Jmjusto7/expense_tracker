import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import AddTransactionModal from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import { useExpenseContext } from "../context/ExpenseContext";

export default function ExpensesPage() {
  const { year, month } = useParams();
  const {
    years,
    travels, // NEW: used to resolve travel titles
    addTransaction,
    updateTransaction,
    removeTransaction,
  } = useExpenseContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDay, setEditDay] = useState(null);

  const yearInt = parseInt(year, 10);
  const yearObj = years.find((y) => y.year === yearInt);
  const monthObj = yearObj?.months?.find((m) => m.name === month);

  // Group transactions by day, sorted most recent first
  const grouped =
    monthObj?.days
      .slice()
      .sort((a, b) => b.day - a.day)
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
      await addTransaction(dayObj.id, t);
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

    for (const t of dayObj.transactions) {
      await removeTransaction(t.id);
    }

    for (const t of updatedTransactions) {
      await addTransaction(dayObj.id, t);
    }

    setEditDay(null);
  };

  // Helper: resolve travel title
  const getTravelTitle = (travelId) => {
    if (!travelId) return "";
    let travelIdInt = parseInt(travelId, 10);
    const travel = travels?.find((t) => t.id === travelIdInt);
    return travel?.title || "";
  };

  // ----------------------
  // Helper: Render Table
  // ----------------------
  // ----------------------
  // Render Table
  // ----------------------
  const renderTable = (transactions) => (
    <table className="w-full text-left border-collapse mb-4">
      <thead>
        <tr className="bg-gray-100">
          <th className="border px-3 py-2 w-[18%]">Category</th>
          <th className="border px-3 py-2 w-[35%]">Breakdown</th>
          <th className="border px-3 py-2 w-[110px] text-right">Total</th>
          <th className="border px-3 py-2 w-[15%]">Travel</th>
          <th className="border px-3 py-2 w-[27%]">Comments</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => {
          const hasMultiple = t.amountBreakdown?.length > 1;
          const breakdownDisplay = hasMultiple
            ? t.amountBreakdown.join(" + ")
            : t.amountBreakdown?.[0] ?? t.amount;

          const travelTitle = getTravelTitle(t.travelId);

          return (
            <tr key={t.id}>
              <td className="border px-3 py-2">
                {t.category}
              </td>

              <td className="border px-3 py-2 font-mono text-gray-600 text-sm">
                {breakdownDisplay}
              </td>

              <td className="border px-3 py-2 font-mono text-right font-semibold text-indigo-600">
                ₱{Number(t.amount || 0).toLocaleString()}
              </td>

              <td className="border px-3 py-2 text-indigo-600 font-medium">
                {travelTitle && `✈ ${travelTitle}`}
              </td>

              <td className="border px-3 py-2 text-gray-500">
                {t.comments}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

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

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition"
        >
          <Plus size={16} />
          Add Transaction
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="text-gray-500">
          No transactions yet for this month.
        </p>
      )}

      {grouped.map(({ day, dayId, transactions }) => {
        const dayTotal = transactions.reduce(
          (sum, t) => sum + Number(t.amount || 0),
          0
        );

        const normalTransactions = transactions.filter(
          (t) => !t.travelId
        );

        const travelGroups = transactions
          .filter((t) => t.travelId)
          .reduce((acc, t) => {
            acc[t.travelId] = acc[t.travelId] || [];
            acc[t.travelId].push(t);
            return acc;
          }, {});

        return (
          <div
            key={dayId}
            className="group mb-8 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative"
          >
            {/* Edit Button */}
            <button
              onClick={() => setEditDay(day)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg p-1.5 transition shadow-sm"
              title="Edit Day"
            >
              <Pencil size={16} />
            </button>

            <div className="flex justify-between mb-5 items-center pr-10">
              <h2 className="text-lg font-semibold text-gray-700">
                Day {day}
              </h2>

              <span className="text-indigo-600 font-bold text-lg">
                ₱{dayTotal.toLocaleString()}
              </span>
            </div>

            {/* ------------------------ */}
            {/* NORMAL TRANSACTIONS */}
            {/* ------------------------ */}
            {normalTransactions.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Daily Expenses
                </div>

                {renderTable(normalTransactions)}

                <div className="text-right text-sm font-semibold text-gray-600">
                  Subtotal: ₱
                  {normalTransactions
                    .reduce(
                      (sum, t) => sum + Number(t.amount || 0),
                      0
                    )
                    .toLocaleString()}
                </div>
              </div>
            )}

            {/* ------------------------ */}
            {/* TRAVEL GROUPS */}
            {/* ------------------------ */}
            {Object.entries(travelGroups).map(
              ([travelId, travelTransactions]) => {
                const travel = travels?.find(
                  (tr) => tr.id === travelId
                );

                const travelSubtotal = travelTransactions.reduce(
                  (sum, t) => sum + Number(t.amount || 0),
                  0
                );

                return (
                  <div
                    key={travelId}
                    className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4"
                  >
                    <div className="flex justify-between mb-3 items-center">
                      <div>
                        <div className="font-semibold text-indigo-700">
                          ✈ {travel?.title || "Travel"}
                        </div>

                        {travel?.startDate && travel?.endDate && (
                          <div className="text-xs text-indigo-500">
                            {travel.startDate} — {travel.endDate}
                          </div>
                        )}
                      </div>

                      <div className="text-indigo-700 font-semibold">
                        ₱{travelSubtotal.toLocaleString()}
                      </div>
                    </div>

                    {renderTable(travelTransactions)}
                  </div>
                );
              }
            )}
          </div>
        );
      })}

      {/* ADD TRANSACTION MODAL */}
      {showAddModal && monthObj && (
        <AddTransactionModal
          year={yearInt}
          month={month}
          travels={travels}
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
          travels={travels}
          transactions={
            monthObj.days.find((d) => d.day === editDay)
              ?.transactions || []
          }
          onClose={() => setEditDay(null)}
          onSave={handleEditTransactions}
        />
      )}
    </div>
  );
}
