// src/components/EditTravelModal.jsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";

export default function EditTravelModal({ travelId, onClose }) {
  const { travels, updateTravel } = useExpenseContext();

  // Find the travel to edit
  const travel = travels.find((t) => t.id === travelId);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comments, setComments] = useState("");

  // Populate fields when modal opens
  useEffect(() => {
    if (travel) {
      setTitle(travel.title || "");
      setStartDate(travel.startDate ? new Date(travel.startDate).toISOString().slice(0, 10) : "");
      setEndDate(travel.endDate ? new Date(travel.endDate).toISOString().slice(0, 10) : "");
      setComments(travel.comments || "");
    }
  }, [travel]);

  const handleSave = async () => {
    if (!title.trim()) return alert("Please enter a travel title.");
    if (!startDate || !endDate) return alert("Please provide start and end dates.");
    if (new Date(startDate) > new Date(endDate))
      return alert("Start date cannot be after end date.");

    try {
      await updateTravel(travelId, {
        title: title.trim(),
        startDate,
        endDate,
        comments: comments.trim(),
      });

      onClose(); // close modal after saving
    } catch (err) {
      console.error("Failed to update travel:", err);
      alert("Failed to save changes.");
    }
  };

  if (!travel) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white w-[90%] max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-semibold mb-4 text-indigo-700">
          Edit Travel
        </h2>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Travel Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Trip to Manila"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full border rounded px-3 py-2 resize-none"
              placeholder="Notes about the travel"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={onClose}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}