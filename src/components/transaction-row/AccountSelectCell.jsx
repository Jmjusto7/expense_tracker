// "Paid From" dropdown for a transaction row - links a transaction to one
// of the user's Assets (or Liability) accounts so its amount reduces that
// account's balance (see ExpenseContext's syncShadowExpenseEntry / db.js
// v8). Linking a purchase to a credit card is the intended way to track
// card spend - it's how the card's Statement Balance actually grows.
//
// Restricted to non-foreign (unit == null) accounts only: a transaction's
// amount is always in PHP, and there's no sensible unit conversion to
// apply linking it to a USD/stock account without going through Convert -
// same reasoning as Transfer's same-unit-only rule. Filtering happens
// here rather than in every caller, since "which accounts are eligible" is
// this selector's own business rule, not the modals'.
export default function AccountSelectCell({ value, onChange, accounts, disabled = false }) {
  const eligible = accounts?.filter((a) => a.unit == null) ?? [];
  const eligibleAssets = eligible.filter((a) => !a.isLiability);
  const eligibleLiabilities = eligible.filter((a) => a.isLiability);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val ? Number(val) : null);
      }}
      disabled={disabled}
      className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">— Not Linked —</option>

      {eligibleAssets.length > 0 && (
        <optgroup label="Assets">
          {eligibleAssets.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </optgroup>
      )}

      {eligibleLiabilities.length > 0 && (
        <optgroup label="Liabilities">
          {eligibleLiabilities.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
