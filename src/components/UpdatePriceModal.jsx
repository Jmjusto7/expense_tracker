import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { toDateInputValue, formatDate } from "../utils/dateHelpers";
import { getLatestPrice, getLatestPriceDate } from "../utils/balanceHelpers";
import { useExpenseContext } from "../context/ExpenseContext";
import Dialog, { Field, inputClass } from "./Dialog";

export default function UpdatePriceModal({ accountId, onClose }) {
  const { accounts, balanceEntries, addMarkPrice } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);

  const costCurrencyAccount = account?.costCurrencyAccountId
    ? accounts.find((a) => a.id === account.costCurrencyAccountId)
    : null;
  const costCurrencyLabel = costCurrencyAccount ? costCurrencyAccount.unit : "PHP";
  const lastPrice = getLatestPrice(balanceEntries, accountId);
  const lastPriceDate = getLatestPriceDate(balanceEntries, accountId);

  const [date, setDate] = useState(toDateInputValue());
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async ({ keepOpen }) => {
    if (!date) return setError("Please pick a date.");
    if (pricePerUnit === "" || isNaN(Number(pricePerUnit)) || Number(pricePerUnit) <= 0)
      return setError("Please enter a valid price.");

    setSaving(true);
    setError("");
    try {
      await addMarkPrice(accountId, {
        date,
        pricePerUnit: Number(pricePerUnit),
        comments: comments.trim(),
      });
      if (!keepOpen) return onClose();
      setNotice(`Saved ${pricePerUnit} ${costCurrencyLabel} for ${formatDate(new Date(`${date}T00:00:00`))}.`);
      setPricePerUnit("");
      setComments("");
    } catch (err) {
      console.error("Failed to update price:", err);
      setError("Failed to save. Please try again.");
    }
    setSaving(false);
  };

  if (!account) return null;

  return (
    <Dialog
      title="Update Price"
      icon={TrendingUp}
      onClose={onClose}
      onSubmit={() => save({ keepOpen: false })}
      onSubmitAnother={() => save({ keepOpen: true })}
      busy={saving}
      error={error}
    >
      {notice && (
        <p role="status" className="text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2 mb-4">
          {notice}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <Field label="Date" htmlFor="price-date">
          <input id="price-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field
          label={`Price (${costCurrencyLabel} per ${account.unit})`}
          htmlFor="price-value"
          hint={`A valuation snapshot - doesn't change how many ${account.unit} you hold, only what they're worth.`}
        >
          <input
            id="price-value"
            type="text"
            inputMode="decimal"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            className={`money ${inputClass}`}
            placeholder={lastPrice != null ? String(lastPrice) : "e.g. 58.00"}
            data-autofocus
          />
          {lastPrice != null && (
            <p className="text-xs text-ink-muted mt-1">
              Last price: <span className="money">{lastPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>{" "}
              {costCurrencyLabel}
              {lastPriceDate ? ` on ${formatDate(lastPriceDate)}` : ""}
            </p>
          )}
        </Field>

        <Field label="Comments (optional)" htmlFor="price-comments">
          <input id="price-comments" type="text" value={comments} onChange={(e) => setComments(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Dialog>
  );
}
