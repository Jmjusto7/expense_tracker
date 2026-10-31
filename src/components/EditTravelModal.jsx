// src/components/EditTravelModal.jsx
import { useState, useEffect } from "react";
import { Plane } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import Dialog, { Field, inputClass } from "./Dialog";

// Trip dates are stored as UTC midnight (from date inputs), so read them back in UTC.
const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function EditTravelModal({ travelId, onClose }) {
  const { travels, updateTravel } = useExpenseContext();
  const travel = travels.find((t) => t.id === travelId);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (travel) {
      setTitle(travel.title || "");
      setStartDate(toInput(travel.startDate));
      setEndDate(toInput(travel.endDate));
      setComments(travel.comments || "");
    }
  }, [travel]);

  const handleSave = async () => {
    if (!title.trim()) return setError("Please enter a travel title.");
    if (!startDate || !endDate) return setError("Please provide start and end dates.");
    if (new Date(startDate) > new Date(endDate)) return setError("Start date cannot be after end date.");

    setSaving(true);
    try {
      await updateTravel(travelId, {
        title: title.trim(),
        startDate,
        endDate,
        comments: comments.trim(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to update travel:", err);
      setError("Failed to save changes.");
      setSaving(false);
    }
  };

  if (!travel) return null;

  return (
    <Dialog
      title="Edit Travel"
      icon={Plane}
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      error={error}
      submitClassName="bg-travel hover:bg-travel-dark"
    >
      <div className="flex flex-col gap-4">
        <Field label="Travel Title" htmlFor="edit-travel-title">
          <input id="edit-travel-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" htmlFor="edit-travel-start">
            <input id="edit-travel-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="End Date" htmlFor="edit-travel-end">
            <input
              id="edit-travel-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Comments (optional)" htmlFor="edit-travel-comments">
          <textarea
            id="edit-travel-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className={`${inputClass} resize-none`}
            placeholder="Notes about the travel"
          />
        </Field>
      </div>
    </Dialog>
  );
}
