import { useState, useMemo } from "react";
import { X, Wallet } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useInlineAddAccountType } from "../hooks/useInlineAddAccountType";
import AccountTypeSelectCell from "./AccountTypeSelectCell";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";

export default function AddAccountModal({ onClose }) {
  const { addAccount, accountTypes, accounts } = useExpenseContext();

  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [startingDate, setStartingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [typeId, setTypeId] = useState(null);

  // Foreign-asset toggle - off means an ordinary PHP account, identical to
  // today. See foreign-assets-plan.md §2.1/§4: this is purely a UI
  // affordance over the underlying nullable `unit` field, not a separate
  // stored flag.
  const [isForeign, setIsForeign] = useState(false);
  const [unit, setUnit] = useState("");
  const [costCurrencyAccountId, setCostCurrencyAccountId] = useState(""); // "" = priced in PHP
  const [startingCostBasis, setStartingCostBasis] = useState("");
  const [startingPrice, setStartingPrice] = useState("");

  const [error, setError] = useState("");

  const { requestAddAccountType, inlineAddAccountTypeModal } = useInlineAddAccountType(
    (newTypeId) => setTypeId(newTypeId)
  );

  // Existing units already in use, for autocomplete - e.g. you probably
  // want every USD account to actually type "USD", not "usd"/"US Dollar"/etc.
  const existingUnits = useMemo(
    () => [...new Set(accounts.map((a) => a.unit).filter(Boolean))],
    [accounts]
  );

  // Any existing foreign account can be a valid "priced in" reference for a
  // brand-new account - a cycle can only happen by editing an existing
  // account's reference, which isn't offered at all (§2.1), so there's
  // nothing to guard against here.
  const referenceableAccounts = useMemo(() => accounts.filter((a) => a.unit != null), [accounts]);

  const costCurrencyLabel = costCurrencyAccountId
    ? referenceableAccounts.find((a) => String(a.id) === String(costCurrencyAccountId))?.unit || "that account"
    : "PHP";

  const handleSave = async () => {
    if (!name.trim()) return setError("Please enter an account name.");
    if (isForeign && !unit.trim()) return setError("Please enter a unit (e.g. USD, AAPL).");
    if (startingBalance === "" || isNaN(Number(startingBalance)))
      return setError(isForeign ? "Please enter a valid starting unit count." : "Please enter a valid starting balance.");
    if (!startingDate) return setError("Please pick a starting date.");
    if (isForeign && (startingPrice === "" || isNaN(Number(startingPrice))))
      return setError(`Please enter the current price (in ${costCurrencyLabel}) - every figure downstream depends on it.`);
    if (startingCostBasis !== "" && isNaN(Number(startingCostBasis)))
      return setError("Cost basis must be a number.");

    try {
      await addAccount({
        name: name.trim(),
        startingBalance: Number(startingBalance),
        startingDate,
        typeId,
        unit: isForeign ? unit.trim() : null,
        costCurrencyAccountId: isForeign && costCurrencyAccountId ? Number(costCurrencyAccountId) : null,
        startingCostBasis: isForeign && startingCostBasis !== "" ? Number(startingCostBasis) : null,
        startingPrice: isForeign ? Number(startingPrice) : null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to add account:", err);
      setError("Failed to save account.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center bg-ink/40 z-50">
        <div className="bg-surface w-[90%] max-w-md rounded-xl shadow-lg p-6 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-ledger-dark" />
            <h2 className="font-display text-xl text-ink">Add Account</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder="Bank A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                Type
              </label>
              <AccountTypeSelectCell
                value={typeId}
                onChange={setTypeId}
                onRequestAdd={requestAddAccountType}
                accountTypes={accountTypes}
              />
            </div>

            {/* FOREIGN ASSET TOGGLE */}
            <div className="flex items-center justify-between border border-border rounded-md px-3 py-2">
              <div>
                <div className="text-sm font-medium text-ink">Track in a foreign currency / asset</div>
                <div className="text-xs text-ink-muted">USD, stock, crypto, etc. - instead of PHP</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isForeign}
                onClick={() => setIsForeign((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  isForeign ? "bg-ledger" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isForeign ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {isForeign && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">Unit</label>
                  <CategoryAutocompleteInput
                    value={unit}
                    onChange={setUnit}
                    categories={existingUnits}
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    e.g. USD, AAPL - can't be changed after the account is created.
                  </p>
                </div>

                {referenceableAccounts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-1">Priced In</label>
                    <select
                      value={costCurrencyAccountId}
                      onChange={(e) => setCostCurrencyAccountId(e.target.value)}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                    >
                      <option value="">PHP (spend PHP directly to acquire this)</option>
                      {referenceableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.unit})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-ink-muted mt-1">
                      Pick an existing account if you spend that account's currency to acquire this
                      one (e.g. a stock bought with USD) - also can't be changed later.
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                {isForeign ? "Starting Units" : "Starting Balance"}
              </label>
              <input
                type="text"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                placeholder={isForeign ? "e.g. 1000" : "e.g. 10000"}
              />
              <p className="text-xs text-ink-muted mt-1">
                This becomes the account's first reconciliation - the starting point
                everything else builds from.
              </p>
            </div>

            {isForeign && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    Cost Basis (optional)
                  </label>
                  <input
                    type="text"
                    value={startingCostBasis}
                    onChange={(e) => setStartingCostBasis(e.target.value)}
                    className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                    placeholder={`e.g. 56500 (in ${costCurrencyLabel})`}
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    What you paid, in {costCurrencyLabel}, for these starting units - skip this if
                    you don't know/it was before you started tracking. Seeds the average cost.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-1">
                    Current Price
                  </label>
                  <input
                    type="text"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    className="money w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
                    placeholder={`e.g. 58.00 (${costCurrencyLabel} per unit)`}
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    Required - every value and gain/loss figure depends on knowing this.
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">
                As Of Date
              </label>
              <input
                type="date"
                value={startingDate}
                onChange={(e) => setStartingDate(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
              />
            </div>

            {error && <p className="text-alert text-sm">{error}</p>}

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={onClose}
                className="border border-border text-ink-muted px-4 py-2 rounded-lg hover:bg-surface-sunken transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-ledger text-white px-4 py-2 rounded-lg hover:bg-ledger-dark transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {inlineAddAccountTypeModal}
    </>
  );
}
