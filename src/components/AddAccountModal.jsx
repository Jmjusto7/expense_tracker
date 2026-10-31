import { useState, useMemo } from "react";
import { Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import { toDateInputValue } from "../utils/dateHelpers";
import AccountTypeSelectCell from "./AccountTypeSelectCell";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import Dialog, { Field, inputClass } from "./Dialog";

export default function AddAccountModal({ onClose, onCreated }) {
  const { addAccount, accountTypes, accounts } = useExpenseContext();

  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [startingDate, setStartingDate] = useState(toDateInputValue());
  const [typeId, setTypeId] = useState(null);

  // Off = ordinary PHP account; on = the account holds `unit` (USD, a stock...).
  const [isForeign, setIsForeign] = useState(false);
  const [unit, setUnit] = useState("");
  const [costCurrencyAccountId, setCostCurrencyAccountId] = useState(""); // "" = priced in PHP
  const [startingCostBasis, setStartingCostBasis] = useState("");
  const [startingPrice, setStartingPrice] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType((newTypeId) => setTypeId(newTypeId));

  const existingUnits = useMemo(() => [...new Set(accounts.map((a) => a.unit).filter(Boolean))], [accounts]);
  const referenceableAccounts = useMemo(() => accounts.filter((a) => a.unit != null), [accounts]);

  const costCurrencyLabel = costCurrencyAccountId
    ? referenceableAccounts.find((a) => String(a.id) === String(costCurrencyAccountId))?.unit || "that account"
    : "PHP";

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter an account name.");
    if (isForeign && !unit.trim()) return setError("Please enter a unit (e.g. USD, AAPL).");
    if (startingBalance !== "" && isNaN(Number(startingBalance)))
      return setError(isForeign ? "Starting units must be a number." : "Starting balance must be a number.");
    if (!startingDate) return setError("Please pick a starting date.");
    if (isForeign && (startingPrice === "" || isNaN(Number(startingPrice))))
      return setError(`Please enter the current price (in ${costCurrencyLabel}) - every figure downstream depends on it.`);
    if (startingCostBasis !== "" && isNaN(Number(startingCostBasis))) return setError("Cost basis must be a number.");

    setSaving(true);
    try {
      const id = await addAccount({
        name: name.trim(),
        startingBalance: Number(startingBalance || 0),
        startingDate,
        typeId,
        unit: isForeign ? unit.trim() : null,
        costCurrencyAccountId: isForeign && costCurrencyAccountId ? costCurrencyAccountId : null,
        startingCostBasis: isForeign && startingCostBasis !== "" ? Number(startingCostBasis) : null,
        startingPrice: isForeign ? Number(startingPrice) : null,
      });
      onClose();
      onCreated?.(id);
    } catch (err) {
      console.error("Failed to add account:", err);
      setError("Failed to save account.");
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog title="Add Account" icon={Wallet} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
        <div className="flex flex-col gap-4">
          <Field label="Account Name" htmlFor="account-name">
            <input
              id="account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Bank A"
            />
          </Field>

          <Field label="Type" htmlFor="account-type">
            <AccountTypeSelectCell
              id="account-type"
              value={typeId}
              onChange={setTypeId}
              onRequestAdd={requestAddAccountType}
              accountTypes={accountTypes}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2">
            <div id="foreign-toggle-label">
              <div className="text-sm font-medium text-ink">Track in a foreign currency / asset</div>
              <div className="text-xs text-ink-muted">USD, stock, crypto, etc. - instead of PHP</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isForeign}
              aria-labelledby="foreign-toggle-label"
              onClick={() => setIsForeign((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isForeign ? "bg-ledger" : "bg-border"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isForeign ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {isForeign && (
            <>
              <Field label="Unit" htmlFor="account-unit" hint="e.g. USD, AAPL - can't be changed after the account is created.">
                <CategoryAutocompleteInput id="account-unit" value={unit} onChange={setUnit} categories={existingUnits} placeholder="USD" />
              </Field>

              {referenceableAccounts.length > 0 && (
                <Field
                  label="Priced In"
                  htmlFor="account-priced-in"
                  hint="Pick an existing account if you spend its currency to acquire this one (e.g. a stock bought with USD) - can't be changed later."
                >
                  <select
                    id="account-priced-in"
                    value={costCurrencyAccountId}
                    onChange={(e) => setCostCurrencyAccountId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">PHP (spend PHP directly to acquire this)</option>
                    {referenceableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.unit})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}

          <Field
            label={isForeign ? "Starting Units" : "Starting Balance"}
            htmlFor="account-starting"
            hint="Becomes the account's first reconciliation. Leave blank for 0."
          >
            <input
              id="account-starting"
              type="text"
              inputMode="decimal"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              className={`money ${inputClass}`}
              placeholder={isForeign ? "e.g. 1000" : "e.g. 10000"}
            />
          </Field>

          {isForeign && (
            <>
              <Field
                label="Cost Basis (optional)"
                htmlFor="account-cost-basis"
                hint={`What you paid, in ${costCurrencyLabel}, for these starting units - skip if unknown. Seeds the average cost.`}
              >
                <input
                  id="account-cost-basis"
                  type="text"
                  inputMode="decimal"
                  value={startingCostBasis}
                  onChange={(e) => setStartingCostBasis(e.target.value)}
                  className={`money ${inputClass}`}
                  placeholder={`e.g. 56500 (in ${costCurrencyLabel})`}
                />
              </Field>

              <Field label="Current Price" htmlFor="account-price" hint="Required - every value and gain/loss figure depends on it.">
                <input
                  id="account-price"
                  type="text"
                  inputMode="decimal"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  className={`money ${inputClass}`}
                  placeholder={`e.g. 58.00 (${costCurrencyLabel} per unit)`}
                />
              </Field>
            </>
          )}

          <Field label="As Of Date" htmlFor="account-date">
            <input id="account-date" type="date" value={startingDate} onChange={(e) => setStartingDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Dialog>

      {inlineAddAccountTypeModal}
    </>
  );
}
