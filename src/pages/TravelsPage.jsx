import { Link, useNavigate } from "react-router-dom";
import { useExpenseContext } from "../context/ExpenseContext";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AddTravelModal from "../components/AddTravelModal";
import EditTravelModal from "../components/EditTravelModal"; // ✅ NEW

const formatDate = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString();
};

export default function TravelsPage() {
  const navigate = useNavigate();
  const { travels, years, removeTravel } = useExpenseContext();

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ----------------------
  // Modal state
  // ----------------------
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTravelId, setEditTravelId] = useState(null);

  // ---------------------------
  // Get total cost for travel
  // ---------------------------
  const getTravelTotal = (travelId) => {
    let total = 0;
    years.forEach((year) => {
      year.months?.forEach((month) => {
        month.days?.forEach((day) => {
          day.transactions?.forEach((t) => {
            if (Number(t.travelId) === Number(travelId)) {
              total += Number(t.amount || 0);
            }
          });
        });
      });
    });
    return total;
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirmDeleteId === id) {
      await removeTravel(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-2">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-indigo-700">
          Travel Summary
        </h1>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition"
        >
          <Plus size={16} />
          Add Travel
        </button>
      </div>

      {travels?.length === 0 && (
        <p className="text-gray-500">No travels created yet.</p>
      )}

      {/* Travel Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {travels?.map((travel) => {
          const total = getTravelTotal(travel.id);

          return (
            <Link
              key={travel.id}
              to={`/travels/${travel.id}`}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition relative block"
            >
              {/* Edit & Delete Buttons */}
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                {/* Edit */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditTravelId(travel.id);
                  }}
                  className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg p-1.5 shadow-sm"
                >
                  <Pencil size={16} />
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(e, travel.id)}
                  className={`rounded-lg p-1.5 shadow-sm text-white ${
                    confirmDeleteId === travel.id
                      ? "bg-red-600"
                      : "bg-red-400 hover:bg-red-500"
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Title */}
              <h2 className="text-lg font-semibold text-gray-800 mb-2 pr-16">
                {travel.title}
              </h2>

              {/* Dates */}
              <div className="text-sm text-gray-500 mb-3">
                {formatDate(travel.startDate)} – {formatDate(travel.endDate)}
              </div>

              {/* Total */}
              <div className="text-xl font-bold text-indigo-600 mb-3">
                ₱{total.toLocaleString()}
              </div>

              {/* Comments */}
              <div className="text-sm text-gray-500 border-t pt-3 mt-3">
                {travel.comments}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ---------------------- */}
      {/* ADD TRAVEL MODAL */}
      {/* ---------------------- */}
      {showAddModal && <AddTravelModal onClose={() => setShowAddModal(false)} />}

      {/* ---------------------- */}
      {/* EDIT TRAVEL MODAL */}
      {/* ---------------------- */}
      {editTravelId && (
        <EditTravelModal
          travelId={editTravelId}
          onClose={() => setEditTravelId(null)}
        />
      )}
    </div>
  );
}