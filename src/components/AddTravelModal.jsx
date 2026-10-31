// src/components/AddTravelModal.jsx
import { useState } from "react";
import { Plane } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { toDateInputValue } from "../utils/dateHelpers";
import Dialog, { Field, inputClass } from "./Dialog";

export default function AddTravelModal({ onClose, onCreated }) {
  const { addTravel } = useExpenseContext();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(toDateInputValue());
  const [endDate, setEndDate] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return setError("Please enter a travel title.");
    if (!startDate || !endDate) return setError("Please provide start and end dates.");
    if (new Date(startDate) > new Date(endDate)) return setError("Start date cannot be after end date.");

    setSaving(true);
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
      setError("Failed to save travel.");
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Add Travel"
      icon={Plane}
      onClose={onClose}
      onSubmit={handleSave}
      busy={saving}
      error={error}
      submitClassName="bg-travel hover:bg-travel-dark"
    >
      <div className="flex flex-col gap-4">
        <Field label="Travel Title" htmlFor="travel-title">
          <input
            id="travel-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Trip to Manila"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" htmlFor="travel-start">
            <input id="travel-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="End Date" htmlFor="travel-end">
            <input
              id="travel-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Comments (optional)" htmlFor="travel-comments">
          <textarea
            id="travel-comments"
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
