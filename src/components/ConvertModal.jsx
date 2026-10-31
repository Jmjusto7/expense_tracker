import { useState, useMemo } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toDateInputValue } from "../utils/dateHelpers";
import { useExpenseContext } from "../context/ExpenseContext";
import { getAccountEntriesSorted, getCurrentBalance, getCurrentValuePhp, getLatestPrice } from "../utils/balanceHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import Dialog, { Field, inputClass } from "./Dialog";

const fmt = (n, digits = 2) => n.toLocaleString(undefined, { maximumFractionDigits: digits });

export default function ConvertModal({ accountId, onClose }) {
  const { accounts, balanceEntries, addConvertEntry, categories } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const costCurrencyAccount = account?.costCurrencyAccountId ? accounts.find((a) => a.id === account.costCurrencyAccountId) : null;
  const costCurrencyLabel = costCurrencyAccount ? costCurrencyAccount.unit : "PHP";

  // Funding source must hold the currency costBasis is denominated in.
  const requiredSourceUnit = costCurrencyAccount ? costCurrencyAccount.unit : null;
  const eligibleSources = useMemo(
    () => accounts.filter((a) => a.id !== accountId && (a.unit || null) === (requiredSourceUnit || null)),
    [accounts, accountId, requiredSourceUnit]
  );
  const eligibleSourceAssets = eligibleSources.filter((a) => !a.isLiability);
  const eligibleSourceLiabilities = eligibleSources.filter((a) => a.isLiability);

  // Default to the funding source used last time.
  const lastSourceId = useMemo(() => {
    const converts = getAccountEntriesSorted(balanceEntries, accountId).filter(
      (e) => e.type === "convert" && e.counterpartAccountId != null
    );
    const last = converts[converts.length - 1]?.counterpartAccountId;
    return eligibleSources.some((a) => a.id === last) ? last : "";
  }, [balanceEntries, accountId, eligibleSources]);

  const [sourceAccountId, setSourceAccountId] = useState(lastSourceId);
  const [date, setDate] = useState(toDateInputValue());
  const [costBasis, setCostBasis] = useState("");
  const [unitsReceived, setUnitsReceived] = useState("");
  const [fee, setFee] = useState("");
  const [feeIncludedInTotal, setFeeIncludedInTotal] = useState(false);
  const [feeCategory, setFeeCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const feeAmt = fee !== "" && !isNaN(Number(fee)) ? Number(fee) : 0;

  // With "fee included" on, the amount field is cost + fee; back the fee out.
  const rawAmount = costBasis !== "" && !isNaN(Number(costBasis)) ? Number(costBasis) : null;
  const effectiveCostBasis = rawAmount == null ? null : feeIncludedInTotal ? rawAmount - feeAmt : rawAmount;

  const impliedRate = useMemo(() => {
    const units = Number(unitsReceived);
    if (!effectiveCostBasis || !units) return null;
    return effectiveCostBasis / units;
  }, [effectiveCostBasis, unitsReceived]);

  const lastPrice = useMemo(() => getLatestPrice(balanceEntries, accountId, new Date(date || Date.now())), [balanceEntries, accountId, date]);
  const suggestedUnits = lastPrice && effectiveCostBasis > 0 ? effectiveCostBasis / lastPrice : null;

  const feePhpPreview = useMemo(() => {
    const feeNum = Number(fee);
    if (!feeNum) return null;
    if (!account?.costCurrencyAccountId) return feeNum;

    const refUnits = getCurrentBalance(balanceEntries, account.costCurrencyAccountId, new Date(date));
    const refValuePhp = getCurrentValuePhp(balanceEntries, accounts, account.costCurrencyAccountId, new Date(date));
    if (!refUnits || refValuePhp == null) return null;
    return feeNum * (refValuePhp / refUnits);
  }, [fee, account, balanceEntries, accounts, date]);

  const handleSave = async () => {
    if (!date) return setError("Please pick a date.");
    const units = Number(unitsReceived);
    if (rawAmount == null || rawAmount <= 0)
      return setError(
        feeIncludedInTotal
          ? `Please enter the total ${costCurrencyLabel} that left the account, including the fee.`
          : `Please enter what you spent, in ${costCurrencyLabel}.`
      );
    if (feeIncludedInTotal && feeAmt >= rawAmount) return setError("Fee can't be greater than or equal to the total amount.");
    if (effectiveCostBasis == null || effectiveCostBasis <= 0) return setError(`Please enter what you spent, in ${costCurrencyLabel}.`);
    if (!unitsReceived || isNaN(units) || units <= 0) return setError("Please enter the units received.");

    setSaving(true);
    try {
      await addConvertEntry(accountId, {
        date,
        amount: units,
        costBasis: effectiveCostBasis,
        fee: fee !== "" ? Number(fee) : null,
        feeCategory: feeCategory.trim() || null,
        comments: comments.trim(),
        sourceAccountId: sourceAccountId || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save conversion:", err);
      setError(err.message || "Failed to save. Please try again.");
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog title={`Convert into ${account.unit}`} icon={ArrowRightLeft} onClose={onClose} onSubmit={handleSave} busy={saving} error={error}>
      <div className="flex flex-col gap-4">
        <Field label="Date" htmlFor="convert-date">
          <input id="convert-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Funding Source" htmlFor="convert-source">
          <select id="convert-source" value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} className={inputClass}>
            <option value="">— Not linked (manual) —</option>
            {eligibleSourceAssets.length > 0 && (
              <optgroup label="Assets">
                {eligibleSourceAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {eligibleSourceLiabilities.length > 0 && (
              <optgroup label="Liabilities">
                {eligibleSourceLiabilities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {sourceAccountId ? (
            <p className="text-xs text-ink-muted mt-1">
              Debits this account for {feeIncludedInTotal ? `the ${costCurrencyLabel} total` : `${costCurrencyLabel} spent + fee`} at the same
              time, so its balance stays accurate.
            </p>
          ) : (
            <p className="text-xs text-warning bg-warning-soft rounded-md px-2 py-1 mt-1">
              {eligibleSources.length === 0
                ? `No account holds ${requiredSourceUnit || "PHP"} yet, so nothing will be debited - adjust the paying account yourself.`
                : "Not linked: the paying account's balance won't go down. Pick a funding source unless you'll reconcile it yourself."}
            </p>
          )}
        </Field>

        <Field label={feeIncludedInTotal ? `${costCurrencyLabel} Total (fee included)` : `${costCurrencyLabel} Spent`} htmlFor="convert-cost">
          <input
            id="convert-cost"
            type="text"
            inputMode="decimal"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            className={`money ${inputClass}`}
            placeholder="e.g. 56500"
            data-autofocus
          />
        </Field>

        <div className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2">
          <div id="fee-included-label">
            <div className="text-sm font-medium text-ink">Fee is included in the amount above</div>
            <div className="text-xs text-ink-muted">Off: the amount is pure cost. On: it&apos;s everything that left the account.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={feeIncludedInTotal}
            aria-labelledby="fee-included-label"
            onClick={() => setFeeIncludedInTotal((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${feeIncludedInTotal ? "bg-ledger" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${feeIncludedInTotal ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        {feeIncludedInTotal && feeAmt > 0 && effectiveCostBasis != null && (
          <div className="bg-surface-sunken rounded-md px-3 py-2 flex justify-between items-center text-sm">
            <span className="text-ink-muted">Cost basis (total − fee)</span>
            <span className="money font-semibold text-ink">
              {fmt(effectiveCostBasis)} {costCurrencyLabel}
            </span>
          </div>
        )}

        <Field label={`${account.unit} Received`} htmlFor="convert-units">
          <input
            id="convert-units"
            type="text"
            inputMode="decimal"
            value={unitsReceived}
            onChange={(e) => setUnitsReceived(e.target.value)}
            className={`money ${inputClass}`}
            placeholder={suggestedUnits ? `≈ ${fmt(suggestedUnits, 4)}` : "e.g. 1000"}
          />
          {suggestedUnits != null && unitsReceived === "" && (
            <button
              type="button"
              onClick={() => setUnitsReceived(String(Math.round(suggestedUnits * 10000) / 10000))}
              className="mt-1 text-xs text-ledger-dark underline underline-offset-2 hover:text-ledger"
            >
              Use ≈ {fmt(suggestedUnits, 4)} {account.unit} (last price {fmt(lastPrice, 4)} {costCurrencyLabel})
            </button>
          )}
        </Field>

        {impliedRate !== null && (
          <div className="bg-surface-sunken rounded-md px-3 py-2 flex flex-wrap justify-between items-center gap-2 text-sm">
            <span className="text-ink-muted">Implied rate</span>
            <span className="money font-semibold text-ink">
              {fmt(impliedRate, 4)} {costCurrencyLabel}/{account.unit}
            </span>
          </div>
        )}

        <Field label={`Fee (optional, in ${costCurrencyLabel})`} htmlFor="convert-fee">
          <input
            id="convert-fee"
            type="text"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={`money ${inputClass}`}
            placeholder="e.g. 200"
          />
        </Field>

        {fee !== "" && Number(fee) > 0 && (
          <>
            <div className="bg-ledger-soft rounded-md px-3 py-2 text-sm text-ledger-dark">
              {feePhpPreview !== null
                ? `Will log an expense: ${formatCurrency(feePhpPreview)}${costCurrencyAccount ? ` (${fee} ${costCurrencyLabel} converted)` : ""}`
                : "Can't preview yet - this account has no price/rate history to convert the fee with."}
            </div>

            <Field label="Fee Category" htmlFor="convert-fee-category" hint='Defaults to "Fees" if left blank.'>
              <CategoryAutocompleteInput id="convert-fee-category" value={feeCategory} onChange={setFeeCategory} categories={categories} />
            </Field>
          </>
        )}

        <Field label="Comments" htmlFor="convert-comments">
          <input id="convert-comments" type="text" value={comments} onChange={(e) => setComments(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Dialog>
  );
}
