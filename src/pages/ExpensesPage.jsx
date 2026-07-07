import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Plus, Pencil, Plane } from "lucide-react";
import AddTransactionModal from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import EditSingleTransactionModal from "../components/EditSingleTransactionModal";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
import { findTravelById, sumAmounts } from "../utils/travelHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/dateHelpers";
import { formatBreakdownDisplay } from "../utils/amountHelpers";
import FilterBar from "../components/FilterBar";
import Breadcrumbs from "../components/Breadcrumbs";

export default function ExpensesPage() {
  const { year, month } = useParams();
  const { years, travels } = useExpenseContext();
  const { matches, hasActiveFilters } = useFilter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDay, setEditDay] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const yearInt = parseInt(year, 10);
  const yearObj = years.find((y) => y.year === yearInt);
  const monthObj = yearObj?.months?.find((m) => m.name === month);

  // Group transactions by day, sorted most recent first. Each day also
  // carries its filtered view (visibleTransactions) - the raw
  // `transactions` is kept too since the Edit modal must always operate on
  // everything in that day, not just what the active filter shows.
  const grouped =
    monthObj?.days
      .slice()
      .sort((a, b) => b.day - a.day)
      .map((d) => {
        const transactions = d.transactions || [];
        const visibleTransactions = hasActiveFilters ? transactions.filter(matches) : transactions;
        return {
          day: d.day,
          dayId: d.id,
          transactions,
          visibleTransactions,
        };
      }) || [];

  // Days that have nothing left once the active filter is applied are
  // skipped entirely rather than rendered as an empty card.
  const visibleGroups = grouped.filter((g) => g.visibleTransactions.length > 0);
  const filteredEverythingOut = hasActiveFilters && grouped.length > 0 && visibleGroups.length === 0;

  // ----------------------
  // Render Table
  // ----------------------
  // variant colors the Total column - ledger green for everyday spend,
  // travel amber for trip-tagged spend - so the accent itself signals
  // which kind of expense a row is, not just the label text.
  const renderTable = (transactions, variant = "normal") => {
    const totalColor = variant === "travel" ? "text-travel-dark" : "text-ledger-dark";

    return (
      <table className="w-full text-left border-collapse mb-4 text-sm">
        <thead>
          <tr className="bg-surface-sunken text-ink-muted text-xs uppercase tracking-wide">
            <th className="border border-border px-3 py-2 w-[17%] font-medium">Category</th>
            <th className="border border-border px-3 py-2 w-[32%] font-medium">Breakdown</th>
            <th className="border border-border px-3 py-2 w-[105px] text-right font-medium">Total</th>
            <th className="border border-border px-3 py-2 w-[14%] font-medium">Travel</th>
            <th className="border border-border px-3 py-2 w-[24%] font-medium">Comments</th>
            <th className="border border-border px-3 py-2 w-[40px]"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const travel = findTravelById(travels, t.travelId);

            return (
              <tr key={t.id}>
                <td className="border border-border px-3 py-2 text-ink">
                  {t.category}
                </td>

                <td className="money border border-border px-3 py-2 text-ink-muted text-xs">
                  {formatBreakdownDisplay(t)}
                </td>

                <td className={`money border border-border px-3 py-2 text-right font-semibold ${totalColor}`}>
                  {formatCurrency(t.amount)}
                </td>

                <td className="border border-border px-3 py-2 text-xs">
                  {travel && (
                    <Link
                      to={`/travels/${travel.id}`}
                      className="text-travel-dark font-medium hover:underline"
                    >
                      ✈ {travel.title}
                    </Link>
                  )}
                </td>

                <td className="border border-border px-3 py-2 text-ink-muted">
                  {t.comments}
                </td>

                <td className="border border-border px-2 py-2 text-center">
                  <button
                    onClick={() => setEditingTransaction(t)}
                    className="text-ink-muted hover:text-ledger-dark p-1"
                    title="Edit this transaction"
                  >
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-center mb-2 gap-2">
        <div>
          <Breadcrumbs
            items={[
              { label: "Expenses", to: "/expenses" },
              { label: year, to: `/expenses/${year}` },
              { label: month },
            ]}
          />
          <h1 className="font-display text-2xl text-ink -mt-1">
            {month} {year}
          </h1>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Transaction
        </button>
      </div>

      <FilterBar />

      {grouped.length === 0 && (
        <p className="text-ink-muted">
          No transactions yet for this month.
        </p>
      )}

      {filteredEverythingOut && (
        <p className="text-ink-muted">
          No transactions match the active filter for this month.
        </p>
      )}

      {visibleGroups.map(({ day, dayId, visibleTransactions }) => {
        const dayTotal = sumAmounts(visibleTransactions);

        const normalTransactions = visibleTransactions.filter((t) => !t.travelId);

        const travelGroups = visibleTransactions
          .filter((t) => t.travelId)
          .reduce((acc, t) => {
            acc[t.travelId] = acc[t.travelId] || [];
            acc[t.travelId].push(t);
            return acc;
          }, {});

        return (
          <div
            key={dayId}
            className="group mb-6 bg-surface p-5 rounded-lg border border-border relative"
          >
            {/* Edit Button */}
            <button
              onClick={() => setEditDay(day)}
              className="absolute top-4 right-4 opacity-70 group-hover:opacity-100 text-ink-muted hover:text-ledger-dark hover:bg-surface-sunken rounded-md p-1.5 transition-all"
              title="Edit Day"
            >
              <Pencil size={16} />
            </button>

            <div className="flex justify-between mb-4 items-center pr-10">
              <h2 className="text-base font-semibold text-ink">
                Day {day}
              </h2>

              <span className="money text-ledger-dark font-bold text-lg">
                {formatCurrency(dayTotal)}
              </span>
            </div>

            {/* ------------------------ */}
            {/* NORMAL TRANSACTIONS */}
            {/* ------------------------ */}
            {normalTransactions.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Daily Expenses
                </div>

                {renderTable(normalTransactions, "normal")}

                <div className="money text-right text-sm font-semibold text-ink-muted">
                  Subtotal: {formatCurrency(sumAmounts(normalTransactions))}
                </div>
              </div>
            )}

            {/* ------------------------ */}
            {/* TRAVEL GROUPS */}
            {/* ------------------------ */}
            {Object.entries(travelGroups).map(
              ([travelId, travelTransactions]) => {
                const travel = findTravelById(travels, travelId);
                const travelSubtotal = sumAmounts(travelTransactions);

                return (
                  <div
                    key={travelId}
                    className="mb-5 bg-travel-soft border border-travel/30 rounded-lg p-4"
                  >
                    <div className="flex justify-between mb-3 items-center">
                      <div className="flex items-center gap-1.5">
                        <Plane size={14} className="text-travel-dark" />
                        <div>
                          <Link
                            to={`/travels/${travel?.id}`}
                            className="font-semibold text-travel-dark hover:underline"
                          >
                            {travel?.title || "Travel"}
                          </Link>

                          {travel?.startDate && travel?.endDate && (
                            <div className="text-xs text-travel-dark/70">
                              {formatDate(travel.startDate)} — {formatDate(travel.endDate)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="money text-travel-dark font-semibold">
                        {formatCurrency(travelSubtotal)}
                      </div>
                    </div>

                    {renderTable(travelTransactions, "travel")}
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
          existingDays={grouped.map((g) => g.day)}
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
            monthObj.days.find((d) => d.day === editDay)
              ?.transactions || []
          }
          onClose={() => setEditDay(null)}
        />
      )}

      {/* EDIT SINGLE TRANSACTION MODAL */}
      {editingTransaction && (
        <EditSingleTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}
