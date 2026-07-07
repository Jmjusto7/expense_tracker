import { getCategorySuggestion, getGhostText } from "../../utils/categoryHelpers";

// Text input with inline "ghost text" autocomplete against known categories.
// Pressing Tab accepts the suggestion. Used by both Add/Edit transaction
// modals for the Category column.
export default function CategoryAutocompleteInput({
  value,
  onChange,
  categories,
  disabled = false,
  inputRef,
}) {
  const suggestion = getCategorySuggestion(categories, value);
  const ghostText = getGhostText(categories, value);

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab" && suggestion) {
            e.preventDefault();
            onChange(suggestion);
          }
        }}
        className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent relative text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="Category"
        disabled={disabled}
        ref={inputRef}
      />

      {value && ghostText && (
        <div className="absolute inset-0 px-2 py-1.5 pointer-events-none text-ink-muted/60 text-sm">
          <span className="invisible">{value}</span>
          {ghostText}
        </div>
      )}
    </div>
  );
}
