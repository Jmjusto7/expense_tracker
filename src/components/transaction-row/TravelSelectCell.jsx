// Travel dropdown for a transaction row, with a "+ Add Travel" option that
// hands control back to the parent (via onRequestAdd) rather than managing
// the AddTravelModal itself - see useInlineAddTravel.
export default function TravelSelectCell({ value, onChange, onRequestAdd, travels, disabled = false }) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const val = e.target.value;

        if (val === "__add__") {
          onRequestAdd();
          return;
        }

        onChange(val);
      }}
      disabled={disabled}
      className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface text-ink focus:ring-2 focus:ring-travel focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— No Travel —</option>

      {travels?.map((travel) => (
        <option key={travel.id} value={travel.id}>
          {travel.title}
        </option>
      ))}

      <option value="__add__">+ Add Travel</option>
    </select>
  );
}
