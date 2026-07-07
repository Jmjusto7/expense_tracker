// src/components/AddTravelModal.jsx
import { useState } from "react";
import { X, Plane } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";

export default function AddTravelModal({ onClose, onCreated }) {
  const { addTravel } = useExpenseContext();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comments, setComments] = useState("");

  const handleSave = async () => {
    if (!title.trim()) return alert("Please enter a travel title.");
    if (!startDate || !endDate) return alert("Please provide start and end dates.");
    if (new Date(startDate) > new Date(endDate))
      return alert("Start date cannot be after end date.");

    try {
      const newTravelId = await addTravel({
        title: title.trim(),
        startDate,
        endDate,
        comments: comments.trim(),
      });
      onCreated?.(newTravelId);
      onClose();
    } catch (err) {
      console.error("Failed to add travel:", err);
      alert("Failed to save travel.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
      <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink-muted hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Plane size={18} className="text-travel-dark" />
          <h2 className="font-display text-xl text-ink">
            Add Travel
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Travel Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-travel focus:outline-none"
              placeholder="Trip to Manila"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-travel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-travel focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface resize-none focus:ring-2 focus:ring-travel focus:outline-none"
              placeholder="Notes about the travel"
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={onClose}
              className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="bg-travel text-white px-4 py-2 rounded-lg hover:bg-travel-dark transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
