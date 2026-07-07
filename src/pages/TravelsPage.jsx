import { Link } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useState } from "react";
import { Plus, Pencil, Trash2, Plane } from "lucide-react";
import AddTravelModal from "../components/AddTravelModal";
import EditTravelModal from "../components/EditTravelModal";
import ConfirmButton from "../components/ConfirmButton";
import { formatDate } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { filterTransactionsByTravel, sumAmounts } from "../utils/travelHelpers";

export default function TravelsPage() {
  const { travels, allTransactions, removeTravel } = useExpenseContext();

  // ----------------------
  // Modal state
  // ----------------------
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTravelId, setEditTravelId] = useState(null);

  // ---------------------------
  // Get total cost for travel
  // ---------------------------
  const getTravelTotal = (travelId) =>
    sumAmounts(filterTransactionsByTravel(allTransactions, travelId));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-2">
        <h1 className="font-display text-2xl text-ink">Travels</h1>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-travel hover:bg-travel-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Travel
        </button>
      </div>

      {travels?.length === 0 && (
        <p className="text-ink-muted">No travels created yet.</p>
      )}

      {/* Travel Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {travels?.map((travel) => {
          const total = getTravelTotal(travel.id);

          return (
            <Link
              key={travel.id}
              to={`/travels/${travel.id}`}
              className="group bg-surface rounded-lg border border-border hover:border-travel p-5 transition-colors relative block"
            >
              {/* Edit & Delete Buttons */}
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditTravelId(travel.id);
                  }}
                  className="bg-surface border border-border text-ink-muted hover:text-ink rounded-md p-1.5"
                >
                  <Pencil size={14} />
                </button>

                <ConfirmButton
                  onConfirm={() => removeTravel(travel.id)}
                  className="bg-surface border border-border text-ink-muted hover:text-alert rounded-md p-1.5"
                  confirmClassName="bg-alert text-white border border-alert rounded-md p-1.5 text-xs font-medium px-2"
                  title="Delete travel"
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </div>

              {/* Title */}
              <div className="flex items-center gap-1.5 mb-2 pr-14">
                <Plane size={15} className="text-travel-dark shrink-0" />
                <h2 className="text-lg font-semibold text-ink truncate">
                  {travel.title}
                </h2>
              </div>

              {/* Dates */}
              <div className="text-sm text-ink-muted mb-3">
                {formatDate(travel.startDate)} – {formatDate(travel.endDate)}
              </div>

              {/* Total */}
              <div className="money text-xl font-bold text-travel-dark mb-3">
                {formatCurrency(total)}
              </div>

              {/* Comments */}
              {travel.comments && (
                <div className="text-sm text-ink-muted border-t border-border pt-3 mt-3">
                  {travel.comments}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* ADD TRAVEL MODAL */}
      {showAddModal && <AddTravelModal onClose={() => setShowAddModal(false)} />}

      {/* EDIT TRAVEL MODAL */}
      {editTravelId && (
        <EditTravelModal
          travelId={editTravelId}
          onClose={() => setEditTravelId(null)}
        />
      )}
    </div>
  );
}
