// Account Type dropdown, with a "+ Add Type" option that hands control
// back to the parent (via onRequestAdd) rather than managing the modal
// itself - see useInlineAddAccountType. Mirrors TravelSelectCell.
export default function AccountTypeSelectCell({ value, onChange, onRequestAdd, accountTypes, disabled = false }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const val = e.target.value;

        if (val === "__add__") {
          onRequestAdd();
          return;
        }

        onChange(val ? Number(val) : null);
      }}
      disabled={disabled}
      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— Unclassified —</option>

      {accountTypes?.map((type) => (
        <option key={type.id} value={type.id}>
          {type.name}
        </option>
      ))}

      <option value="__add__">+ Add Type</option>
    </select>
  );
}
