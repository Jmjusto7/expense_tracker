import { useState, useMemo } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toDateInputValue } from "../utils/dateHelpers";
import { getAccountEntriesSorted, getStatementInfo } from "../utils/balanceHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { useExpenseContext } from "../context/ExpenseContext";
import CategoryAutocompleteInput from "./transaction-row/CategoryAutocompleteInput";
import Dialog, { Field, inputClass } from "./Dialog";

// Moves units between `accountId` and another same-unit account.
// mode="outgoing": accountId is "From". mode="incoming": accountId is "To" -
// used for paying off a liability (the positive leg reduces what's owed).
// Crossing currencies is a Convert instead.
export default function TransferModal({ accountId, onClose, mode = "outgoing" }) {
  const { accounts, balanceEntries, addTransfer, categories } = useExpenseContext();
  const account = accounts.find((a) => a.id === accountId);
  const isIncoming = mode === "incoming";
  const unitLabel = account?.unit || "PHP";

  const eligibleCounterparts = useMemo(
    () => accounts.filter((a) => a.id !== accountId && (a.unit || null) === (account?.unit || null)),
    [accounts, accountId, account]
  );

  // Prefill with whichever account was used last in this direction.
  const lastCounterpartId = useMemo(() => {
    const transfers = getAccountEntriesSorted(balanceEntries, accountId).filter(
      (e) => e.type === "transfer" && e.counterpartAccountId != null && (isIncoming ? e.amount > 0 : e.amount < 0)
    );
    const last = transfers[transfers.length - 1]?.counterpartAccountId;
    return eligibleCounterparts.some((a) => a.id === last) ? last : "";
  }, [balanceEntries, accountId, isIncoming, eligibleCounterparts]);

  // A payment defaults to what's still due on the last statement.
  const statementDue = useMemo(() => {
    if (!isIncoming || !account?.isLiability) return null;
    const due = getStatementInfo(balanceEntries, account).remainingDue;
    return due != null && due > 0 ? Math.round(due * 100) / 100 : null;
  }, [isIncoming, account, balanceEntries]);

  const [counterpartId, setCounterpartId] = useState(lastCounterpartId);
  const [date, setDate] = useState(toDateInputValue());
  const [amount, setAmount] = useState(statementDue != null ? String(statementDue) : "");
  const [fee, setFee] = useState("");
  const [feeCategory, setFeeCategory] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async ({ keepOpen }) => {
    if (!counterpartId) return setError(`Please choose ${isIncoming ? "which account this is coming from" : "a destination account"}.`);
    if (!date) return setError("Please pick a date.");

    const n = Number(amount);
    if (amount === "" || isNaN(n) || n <= 0) return setError(`Please enter a positive amount, in ${unitLabel}.`);
    if (fee !== "" && (isNaN(Number(fee)) || Number(fee) < 0))
      return setError(`Please enter a valid fee, in ${unitLabel}, or leave it blank.`);
    if (fee !== "" && Number(fee) >= n) return setError("The fee must be less than the transfer amount.");

    setSaving(true);
    setError("");
    try {
      const fromId = isIncoming ? counterpartId : accountId;
      const toId = isIncoming ? accountId : counterpartId;
      await addTransfer(fromId, toId, {
        date,
        amount: n,
        comments,
        fee: fee !== "" ? Number(fee) : null,
        feeCategory: feeCategory.trim() || null,
      });
      if (!keepOpen) return onClose();
      setNotice(`Saved ${n.toLocaleString()} ${unitLabel}.`);
      setAmount("");
      setFee("");
      setComments("");
    } catch (err) {
      console.error("Failed to transfer:", err);
      setError(err.message || "Failed to save. Please try again.");
    }
    setSaving(false);
  };

  if (!account) return null;

  const fixedAccount = (
    <div className="w-full border border-border rounded-md px-3 py-2 text-ink bg-surface-sunken text-sm">{account.name}</div>
  );
  const assets = eligibleCounterparts.filter((a) => !a.isLiability);
  const liabilities = eligibleCounterparts.filter((a) => a.isLiability);
  const noCounterparts = eligibleCounterparts.length === 0;

  return (
    <Dialog
      title={isIncoming ? "Make a Payment" : "Transfer"}
      icon={ArrowLeftRight}
      onClose={onClose}
      onSubmit={noCounterparts ? undefined : () => save({ keepOpen: false })}
      onSubmitAnother={noCounterparts ? undefined : () => save({ keepOpen: true })}
      busy={saving}
      error={error}
      cancelLabel={noCounterparts ? "Close" : "Cancel"}
    >
      {notice && (
        <p role="status" className="text-sm text-ledger-dark bg-ledger-soft rounded-md px-3 py-2 mb-4">
          {notice}
        </p>
      )}

      {noCounterparts ? (
        <p className="text-sm text-ink-muted">
          No other accounts share this account&apos;s currency ({unitLabel}) yet. Add one first, or use Convert on this
          account if what you actually want is to change currencies.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {!isIncoming && <Field label="From">{fixedAccount}</Field>}

          <Field label={isIncoming ? "From" : "To"} htmlFor="transfer-counterpart">
            <select
              id="transfer-counterpart"
              value={counterpartId}
              onChange={(e) => setCounterpartId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choose account —</option>
              {assets.length > 0 && (
                <optgroup label="Assets">
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {liabilities.length > 0 && (
                <optgroup label="Liabilities">
                  {liabilities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>

          {isIncoming && <Field label="To">{fixedAccount}</Field>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date" htmlFor="transfer-date">
              <input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field
              label={`Amount (${unitLabel})`}
              htmlFor="transfer-amount"
              hint={statementDue != null ? `Statement balance still due: ${formatCurrency(statementDue)}` : undefined}
            >
              <input
                id="transfer-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`money ${inputClass}`}
                placeholder="e.g. 5000"
                data-autofocus
              />
            </Field>
          </div>

          <Field
            label={`Fee (optional, in ${unitLabel})`}
            htmlFor="transfer-fee"
            hint="What arrives is Amount − Fee; the fee is auto-logged as an expense."
          >
            <input
              id="transfer-fee"
              type="text"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className={`money ${inputClass}`}
              placeholder="e.g. 50"
            />
          </Field>

          {fee !== "" && Number(fee) > 0 && (
            <Field label="Fee Category" htmlFor="transfer-fee-category" hint='Defaults to "Fees" if left blank.'>
              <CategoryAutocompleteInput id="transfer-fee-category" value={feeCategory} onChange={setFeeCategory} categories={categories} />
            </Field>
          )}

          <Field label="Comments" htmlFor="transfer-comments">
            <input id="transfer-comments" type="text" value={comments} onChange={(e) => setComments(e.target.value)} className={inputClass} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
